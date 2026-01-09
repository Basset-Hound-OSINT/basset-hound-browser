/**
 * Screenshot Manager Unit Tests
 *
 * Phase 21: Advanced Screenshot Capabilities
 *
 * Comprehensive tests for screenshot manager including:
 * - Basic screenshot capture
 * - Screenshot comparison and visual diffs
 * - Screenshot stitching
 * - Annotation overlay
 * - OCR text extraction
 * - Element highlighting
 * - Automatic PII blurring
 * - Quality presets
 * - Metadata enrichment
 */

const {
  ScreenshotManager,
  FORMAT_CONFIG,
  QUALITY_PRESETS,
  PII_PATTERNS,
  ANNOTATION_TYPES,
  validateAnnotation,
  applyAnnotationDefaults
} = require('../../screenshots/manager');

// Mock Electron IPC
const mockIpcMain = {
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn()
};

// Mock main window
const createMockWindow = () => ({
  webContents: {
    send: jest.fn(),
    getUserAgent: jest.fn(() => 'Mozilla/5.0 Test'),
    getURL: jest.fn(() => 'https://example.com'),
    getTitle: jest.fn(() => 'Example Domain')
  }
});

jest.mock('electron', () => ({
  ipcMain: mockIpcMain
}));

describe('ScreenshotManager', () => {
  let manager;
  let mockWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWindow = createMockWindow();
    manager = new ScreenshotManager(mockWindow);
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  describe('initialization', () => {
    test('should initialize with main window', () => {
      expect(manager).toBeDefined();
      expect(manager.mainWindow).toBe(mockWindow);
      expect(manager.pendingRequests).toBeDefined();
      expect(manager.requestIdCounter).toBe(0);
    });

    test('should setup IPC listeners', () => {
      expect(mockIpcMain.on).toHaveBeenCalled();
      const callCount = mockIpcMain.on.mock.calls.length;
      expect(callCount).toBeGreaterThan(10); // Multiple response channels
    });

    test('should generate unique request IDs', () => {
      const id1 = manager.generateRequestId();
      const id2 = manager.generateRequestId();
      expect(id1).not.toBe(id2);
      expect(id1).toContain('screenshot-');
      expect(id2).toContain('screenshot-');
    });
  });

  describe('FORMAT_CONFIG', () => {
    test('should have PNG configuration', () => {
      expect(FORMAT_CONFIG.png).toBeDefined();
      expect(FORMAT_CONFIG.png.mimeType).toBe('image/png');
      expect(FORMAT_CONFIG.png.extension).toBe('.png');
      expect(FORMAT_CONFIG.png.quality).toBe(1.0);
    });

    test('should have JPEG configuration', () => {
      expect(FORMAT_CONFIG.jpeg).toBeDefined();
      expect(FORMAT_CONFIG.jpeg.mimeType).toBe('image/jpeg');
      expect(FORMAT_CONFIG.jpeg.extension).toBe('.jpg');
      expect(FORMAT_CONFIG.jpeg.quality).toBe(0.92);
    });

    test('should have WebP configuration', () => {
      expect(FORMAT_CONFIG.webp).toBeDefined();
      expect(FORMAT_CONFIG.webp.mimeType).toBe('image/webp');
      expect(FORMAT_CONFIG.webp.extension).toBe('.webp');
    });
  });

  describe('QUALITY_PRESETS', () => {
    test('should have forensic preset', () => {
      expect(QUALITY_PRESETS.forensic).toBeDefined();
      expect(QUALITY_PRESETS.forensic.format).toBe('png');
      expect(QUALITY_PRESETS.forensic.quality).toBe(1.0);
      expect(QUALITY_PRESETS.forensic.compression).toBe(0);
    });

    test('should have web preset', () => {
      expect(QUALITY_PRESETS.web).toBeDefined();
      expect(QUALITY_PRESETS.web.format).toBe('webp');
      expect(QUALITY_PRESETS.web.quality).toBe(0.85);
    });

    test('should have thumbnail preset', () => {
      expect(QUALITY_PRESETS.thumbnail).toBeDefined();
      expect(QUALITY_PRESETS.thumbnail.format).toBe('jpeg');
      expect(QUALITY_PRESETS.thumbnail.quality).toBe(0.6);
    });

    test('should have archival preset', () => {
      expect(QUALITY_PRESETS.archival).toBeDefined();
      expect(QUALITY_PRESETS.archival.format).toBe('png');
      expect(QUALITY_PRESETS.archival.compression).toBe(9);
    });

    test('all presets should have descriptions', () => {
      Object.values(QUALITY_PRESETS).forEach(preset => {
        expect(preset.description).toBeDefined();
        expect(preset.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PII_PATTERNS', () => {
    test('should have email pattern', () => {
      expect(PII_PATTERNS.email).toBeDefined();
      expect(PII_PATTERNS.email).toBeInstanceOf(RegExp);
      expect('test@example.com').toMatch(PII_PATTERNS.email);
    });

    test('should have phone pattern', () => {
      expect(PII_PATTERNS.phone).toBeDefined();
      expect(PII_PATTERNS.phone).toBeInstanceOf(RegExp);
    });

    test('should have SSN pattern', () => {
      expect(PII_PATTERNS.ssn).toBeDefined();
      expect('123-45-6789').toMatch(PII_PATTERNS.ssn);
    });

    test('should have credit card pattern', () => {
      expect(PII_PATTERNS.creditCard).toBeDefined();
      expect('4532-1234-5678-9010').toMatch(PII_PATTERNS.creditCard);
    });

    test('should have IP address pattern', () => {
      expect(PII_PATTERNS.ipAddress).toBeDefined();
      expect('192.168.1.1').toMatch(PII_PATTERNS.ipAddress);
    });
  });

  describe('ANNOTATION_TYPES', () => {
    test('should have text annotation type', () => {
      expect(ANNOTATION_TYPES.text).toBeDefined();
      expect(ANNOTATION_TYPES.text.required).toContain('text');
      expect(ANNOTATION_TYPES.text.required).toContain('x');
      expect(ANNOTATION_TYPES.text.required).toContain('y');
    });

    test('should have rectangle annotation type', () => {
      expect(ANNOTATION_TYPES.rectangle).toBeDefined();
      expect(ANNOTATION_TYPES.rectangle.required).toContain('width');
      expect(ANNOTATION_TYPES.rectangle.required).toContain('height');
    });

    test('should have arrow annotation type', () => {
      expect(ANNOTATION_TYPES.arrow).toBeDefined();
      expect(ANNOTATION_TYPES.arrow.required).toContain('startX');
      expect(ANNOTATION_TYPES.arrow.required).toContain('endY');
    });

    test('should have blur annotation type', () => {
      expect(ANNOTATION_TYPES.blur).toBeDefined();
      expect(ANNOTATION_TYPES.blur.defaults.intensity).toBe(10);
    });

    test('should have highlight annotation type', () => {
      expect(ANNOTATION_TYPES.highlight).toBeDefined();
      expect(ANNOTATION_TYPES.highlight.defaults.opacity).toBe(0.3);
    });
  });

  describe('validateAnnotation', () => {
    test('should validate correct text annotation', () => {
      const annotation = {
        type: 'text',
        text: 'Test',
        x: 10,
        y: 20
      };
      const result = validateAnnotation(annotation);
      expect(result.valid).toBe(true);
    });

    test('should reject annotation with missing type', () => {
      const annotation = { x: 10, y: 20 };
      const result = validateAnnotation(annotation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    test('should reject annotation with unknown type', () => {
      const annotation = { type: 'unknown', x: 10, y: 20 };
      const result = validateAnnotation(annotation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown annotation type');
    });

    test('should reject annotation with missing required field', () => {
      const annotation = { type: 'text', x: 10 }; // missing y and text
      const result = validateAnnotation(annotation);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required field');
    });

    test('should validate arrow annotation', () => {
      const annotation = {
        type: 'arrow',
        startX: 0,
        startY: 0,
        endX: 100,
        endY: 100
      };
      const result = validateAnnotation(annotation);
      expect(result.valid).toBe(true);
    });
  });

  describe('applyAnnotationDefaults', () => {
    test('should apply defaults to text annotation', () => {
      const annotation = { type: 'text', text: 'Test', x: 10, y: 20 };
      const result = applyAnnotationDefaults(annotation);
      expect(result.fontSize).toBe(16);
      expect(result.fontFamily).toBe('Arial');
      expect(result.color).toBe('#FF0000');
    });

    test('should not override provided values', () => {
      const annotation = {
        type: 'text',
        text: 'Test',
        x: 10,
        y: 20,
        fontSize: 24
      };
      const result = applyAnnotationDefaults(annotation);
      expect(result.fontSize).toBe(24); // Custom value preserved
    });

    test('should handle unknown annotation type', () => {
      const annotation = { type: 'unknown', x: 10 };
      const result = applyAnnotationDefaults(annotation);
      expect(result).toEqual(annotation); // Returns unchanged
    });
  });

  describe('captureViewport', () => {
    test('should capture viewport with default options', async () => {
      const promise = manager.captureViewport();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-viewport',
        expect.objectContaining({
          requestId: expect.any(String),
          format: 'png',
          quality: 1.0
        })
      );
    });

    test('should capture viewport with custom format', async () => {
      const promise = manager.captureViewport({ format: 'jpeg' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-viewport',
        expect.objectContaining({
          format: 'jpeg',
          quality: 0.92
        })
      );
    });

    test('should capture viewport with custom quality', async () => {
      const promise = manager.captureViewport({ format: 'png', quality: 0.8 });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-viewport',
        expect.objectContaining({
          format: 'png',
          quality: 0.8
        })
      );
    });
  });

  describe('captureFullPage', () => {
    test('should capture full page with default options', async () => {
      const promise = manager.captureFullPage();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-full-page',
        expect.objectContaining({
          requestId: expect.any(String),
          format: 'png',
          scrollDelay: 100,
          maxHeight: 32000
        })
      );
    });

    test('should capture full page with custom scroll delay', async () => {
      const promise = manager.captureFullPage({ scrollDelay: 200 });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-full-page',
        expect.objectContaining({
          scrollDelay: 200
        })
      );
    });
  });

  describe('captureElement', () => {
    test('should capture element with selector', async () => {
      const promise = manager.captureElement('.test-element');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-element',
        expect.objectContaining({
          requestId: expect.any(String),
          selector: '.test-element',
          format: 'png',
          padding: 0
        })
      );
    });

    test('should capture element with padding', async () => {
      const promise = manager.captureElement('.test', { padding: 20 });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-element',
        expect.objectContaining({
          selector: '.test',
          padding: 20
        })
      );
    });
  });

  describe('captureArea', () => {
    test('should capture area with coordinates', async () => {
      const area = { x: 10, y: 20, width: 100, height: 200 };
      const promise = manager.captureArea(area);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-area',
        expect.objectContaining({
          requestId: expect.any(String),
          area,
          format: 'png'
        })
      );
    });

    test('should reject invalid area (missing x)', () => {
      const area = { y: 20, width: 100, height: 200 };
      const promise = manager.captureArea(area);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid area coordinates');
      });
    });

    test('should reject invalid area (missing width)', () => {
      const area = { x: 10, y: 20, height: 200 };
      const promise = manager.captureArea(area);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid area coordinates');
      });
    });
  });

  describe('compareScreenshots', () => {
    test('should compare two screenshots', async () => {
      const imageData1 = 'data:image/png;base64,abc123';
      const imageData2 = 'data:image/png;base64,def456';

      const promise = manager.compareScreenshots(imageData1, imageData2);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'compare-screenshots',
        expect.objectContaining({
          requestId: expect.any(String),
          imageData1,
          imageData2,
          threshold: 0.1,
          highlightColor: '#FF0000'
        })
      );
    });

    test('should reject when imageData1 is missing', () => {
      const promise = manager.compareScreenshots(null, 'data:image/png;base64,def456');

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('Both imageData1 and imageData2 are required');
      });
    });

    test('should accept custom threshold', async () => {
      const promise = manager.compareScreenshots(
        'data:image/png;base64,abc',
        'data:image/png;base64,def',
        { threshold: 0.5 }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'compare-screenshots',
        expect.objectContaining({
          threshold: 0.5
        })
      );
    });
  });

  describe('stitchScreenshots', () => {
    test('should stitch screenshots vertically', async () => {
      const imageDatas = [
        'data:image/png;base64,abc',
        'data:image/png;base64,def'
      ];

      const promise = manager.stitchScreenshots(imageDatas);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stitch-screenshots',
        expect.objectContaining({
          requestId: expect.any(String),
          imageDatas,
          direction: 'vertical',
          gap: 0
        })
      );
    });

    test('should stitch screenshots horizontally', async () => {
      const imageDatas = ['data:image/png;base64,abc'];

      const promise = manager.stitchScreenshots(imageDatas, { direction: 'horizontal' });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stitch-screenshots',
        expect.objectContaining({
          direction: 'horizontal'
        })
      );
    });

    test('should reject empty array', () => {
      const promise = manager.stitchScreenshots([]);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('at least one image is required');
      });
    });

    test('should accept gap parameter', async () => {
      const promise = manager.stitchScreenshots(
        ['data:image/png;base64,abc'],
        { gap: 10 }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'stitch-screenshots',
        expect.objectContaining({
          gap: 10
        })
      );
    });
  });

  describe('extractTextFromScreenshot', () => {
    test('should extract text with default language', async () => {
      const imageData = 'data:image/png;base64,abc123';

      const promise = manager.extractTextFromScreenshot(imageData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'ocr-screenshot',
        expect.objectContaining({
          requestId: expect.any(String),
          imageData,
          language: 'eng',
          overlay: false
        })
      );
    });

    test('should extract text with custom language', async () => {
      const promise = manager.extractTextFromScreenshot(
        'data:image/png;base64,abc',
        { language: 'fra' }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'ocr-screenshot',
        expect.objectContaining({
          language: 'fra'
        })
      );
    });

    test('should reject missing imageData', () => {
      const promise = manager.extractTextFromScreenshot(null);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('imageData is required');
      });
    });

    test('should accept overlay option', async () => {
      const promise = manager.extractTextFromScreenshot(
        'data:image/png;base64,abc',
        { overlay: true }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'ocr-screenshot',
        expect.objectContaining({
          overlay: true
        })
      );
    });
  });

  describe('captureWithHighlights', () => {
    test('should capture with element highlights', async () => {
      const selectors = ['.element1', '.element2'];

      const promise = manager.captureWithHighlights(selectors);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-with-highlights',
        expect.objectContaining({
          requestId: expect.any(String),
          selectors,
          highlightColor: '#FFFF00',
          highlightOpacity: 0.3
        })
      );
    });

    test('should reject empty selectors array', () => {
      const promise = manager.captureWithHighlights([]);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('selectors array is required');
      });
    });

    test('should accept custom highlight options', async () => {
      const promise = manager.captureWithHighlights(
        ['.test'],
        {
          highlightColor: '#00FF00',
          highlightOpacity: 0.5,
          borderWidth: 4
        }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-with-highlights',
        expect.objectContaining({
          highlightColor: '#00FF00',
          highlightOpacity: 0.5,
          borderWidth: 4
        })
      );
    });
  });

  describe('captureWithBlur', () => {
    test('should capture with PII blurring', async () => {
      const promise = manager.captureWithBlur();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-with-blur',
        expect.objectContaining({
          requestId: expect.any(String),
          blurPatterns: expect.arrayContaining(['email', 'phone', 'ssn']),
          blurIntensity: 10,
          detectText: true
        })
      );
    });

    test('should accept custom blur patterns', async () => {
      const promise = manager.captureWithBlur({
        blurPatterns: ['email', 'creditCard']
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-with-blur',
        expect.objectContaining({
          blurPatterns: ['email', 'creditCard']
        })
      );
    });

    test('should accept custom selectors for blurring', async () => {
      const promise = manager.captureWithBlur({
        customSelectors: ['.sensitive-data', '#password']
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-with-blur',
        expect.objectContaining({
          customSelectors: ['.sensitive-data', '#password']
        })
      );
    });
  });

  describe('enrichMetadata', () => {
    test('should enrich screenshot metadata', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await manager.enrichMetadata(imageData);

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.hash).toBeDefined();
      expect(result.metadata.size).toBeGreaterThan(0);
      expect(result.hash).toBeDefined();
    });

    test('should include custom metadata', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const customMetadata = { investigator: 'John Doe', caseId: '12345' };

      const result = await manager.enrichMetadata(imageData, customMetadata);

      expect(result.success).toBe(true);
      expect(result.metadata.captureInfo.investigator).toBe('John Doe');
      expect(result.metadata.captureInfo.caseId).toBe('12345');
    });

    test('should reject missing imageData', async () => {
      const result = await manager.enrichMetadata(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('imageData is required');
    });

    test('should include browser context in metadata', async () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await manager.enrichMetadata(imageData);

      expect(result.metadata.captureInfo.userAgent).toBe('Mozilla/5.0 Test');
      expect(result.metadata.captureInfo.url).toBe('https://example.com');
      expect(result.metadata.captureInfo.title).toBe('Example Domain');
    });
  });

  describe('calculateSimilarity', () => {
    test('should calculate screenshot similarity', async () => {
      const imageData1 = 'data:image/png;base64,abc';
      const imageData2 = 'data:image/png;base64,def';

      const promise = manager.calculateSimilarity(imageData1, imageData2);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'calculate-similarity',
        expect.objectContaining({
          requestId: expect.any(String),
          imageData1,
          imageData2,
          method: 'perceptual'
        })
      );
    });

    test('should accept custom comparison method', async () => {
      const promise = manager.calculateSimilarity(
        'data:image/png;base64,abc',
        'data:image/png;base64,def',
        { method: 'pixel' }
      );

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'calculate-similarity',
        expect.objectContaining({
          method: 'pixel'
        })
      );
    });
  });

  describe('captureElementWithContext', () => {
    test('should capture element with context', async () => {
      const selector = '.target-element';

      const promise = manager.captureElementWithContext(selector);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-element-with-context',
        expect.objectContaining({
          requestId: expect.any(String),
          selector,
          contextPadding: 50,
          highlightElement: true
        })
      );
    });

    test('should reject missing selector', () => {
      const promise = manager.captureElementWithContext(null);

      return promise.then(result => {
        expect(result.success).toBe(false);
        expect(result.error).toContain('selector is required');
      });
    });

    test('should accept custom context padding', async () => {
      const promise = manager.captureElementWithContext('.test', {
        contextPadding: 100
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-element-with-context',
        expect.objectContaining({
          contextPadding: 100
        })
      );
    });
  });

  describe('captureScrolling', () => {
    test('should capture scrolling screenshot', async () => {
      const promise = manager.captureScrolling();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-scrolling',
        expect.objectContaining({
          requestId: expect.any(String),
          scrollDelay: 100,
          scrollStep: 500,
          maxHeight: 32000
        })
      );
    });

    test('should accept custom scroll options', async () => {
      const promise = manager.captureScrolling({
        scrollDelay: 200,
        scrollStep: 1000
      });

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'screenshot-scrolling',
        expect.objectContaining({
          scrollDelay: 200,
          scrollStep: 1000
        })
      );
    });
  });

  describe('configureQuality', () => {
    test('should configure forensic preset', () => {
      const result = manager.configureQuality('forensic');

      expect(result.success).toBe(true);
      expect(result.preset).toBe('forensic');
      expect(result.config).toEqual(QUALITY_PRESETS.forensic);
    });

    test('should configure web preset', () => {
      const result = manager.configureQuality('web');

      expect(result.success).toBe(true);
      expect(result.config.format).toBe('webp');
    });

    test('should reject unknown preset', () => {
      const result = manager.configureQuality('unknown');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown preset');
    });
  });

  describe('getQualityPresets', () => {
    test('should return all quality presets', () => {
      const result = manager.getQualityPresets();

      expect(result.success).toBe(true);
      expect(result.presets).toBe(QUALITY_PRESETS);
      expect(Object.keys(result.presets)).toContain('forensic');
      expect(Object.keys(result.presets)).toContain('web');
      expect(Object.keys(result.presets)).toContain('thumbnail');
      expect(Object.keys(result.presets)).toContain('archival');
    });
  });

  describe('getPIIPatterns', () => {
    test('should return all PII patterns', () => {
      const result = manager.getPIIPatterns();

      expect(result.success).toBe(true);
      expect(result.patterns).toContain('email');
      expect(result.patterns).toContain('phone');
      expect(result.patterns).toContain('ssn');
      expect(result.patterns).toContain('creditCard');
      expect(result.patterns).toContain('ipAddress');
    });
  });

  describe('getSupportedFormats', () => {
    test('should return supported formats', () => {
      const formats = manager.getSupportedFormats();

      expect(formats).toContain('png');
      expect(formats).toContain('jpeg');
      expect(formats).toContain('webp');
    });
  });

  describe('getFormatConfig', () => {
    test('should return config for valid format', () => {
      const config = manager.getFormatConfig('png');

      expect(config).toBe(FORMAT_CONFIG.png);
      expect(config.mimeType).toBe('image/png');
    });

    test('should return default config for invalid format', () => {
      const config = manager.getFormatConfig('invalid');

      expect(config).toBe(FORMAT_CONFIG.png); // Default fallback
    });
  });

  describe('cleanup', () => {
    test('should clear pending requests', () => {
      manager.pendingRequests.set('test-id', () => {});
      expect(manager.pendingRequests.size).toBe(1);

      manager.cleanup();

      expect(manager.pendingRequests.size).toBe(0);
    });
  });

  describe('timeout handling', () => {
    jest.useFakeTimers();

    test('should timeout viewport screenshot after 30 seconds', async () => {
      const promise = manager.captureViewport();

      jest.advanceTimersByTime(30000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should timeout full page screenshot after 120 seconds', async () => {
      const promise = manager.captureFullPage();

      jest.advanceTimersByTime(120000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    test('should timeout comparison after 60 seconds', async () => {
      const promise = manager.compareScreenshots(
        'data:image/png;base64,abc',
        'data:image/png;base64,def'
      );

      jest.advanceTimersByTime(60000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    afterAll(() => {
      jest.useRealTimers();
    });
  });
});

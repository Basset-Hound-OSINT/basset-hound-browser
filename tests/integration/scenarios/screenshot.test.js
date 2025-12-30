/**
 * Screenshot Test Scenarios
 *
 * Tests screenshot capture functionality between extension and browser.
 */

const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8772;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Mock screenshot data (1x1 PNG base64)
const MOCK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const MOCK_JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAAAAAH/2Q==';

/**
 * Test utilities
 */
const testUtils = {
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Setup screenshot handlers
 */
function setupScreenshotHandlers() {
  // Basic viewport screenshot
  server.registerHandler('screenshot', async (params) => {
    const { format = 'png', quality = 100 } = params;

    if (!['png', 'jpeg', 'webp'].includes(format)) {
      return { success: false, error: `Invalid format: ${format}` };
    }

    if (typeof quality !== 'number' || quality < 1 || quality > 100) {
      return { success: false, error: 'Quality must be between 1 and 100' };
    }

    const data = format === 'jpeg' ? MOCK_JPEG : MOCK_PNG;

    return {
      success: true,
      data: `data:image/${format};base64,${data}`,
      format,
      quality,
      width: 1920,
      height: 1080,
      type: 'viewport'
    };
  });

  // Viewport screenshot with options
  server.registerHandler('screenshot_viewport', async (params) => {
    const { format = 'png', quality = 100, scale = 1 } = params;

    return {
      success: true,
      data: `data:image/${format};base64,${format === 'jpeg' ? MOCK_JPEG : MOCK_PNG}`,
      format,
      quality,
      width: Math.round(1920 * scale),
      height: Math.round(1080 * scale),
      scale,
      type: 'viewport'
    };
  });

  // Full page screenshot
  server.registerHandler('screenshot_full_page', async (params) => {
    const { format = 'png', quality = 100 } = params;

    return {
      success: true,
      data: `data:image/${format};base64,${format === 'jpeg' ? MOCK_JPEG : MOCK_PNG}`,
      format,
      quality,
      width: 1920,
      height: 5000, // Full page is taller
      type: 'full_page'
    };
  });

  // Element screenshot
  server.registerHandler('screenshot_element', async (params) => {
    const { selector, format = 'png', quality = 100, padding = 0 } = params;

    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    // Simulate element not found
    if (selector === '#nonexistent') {
      return { success: false, error: 'Element not found' };
    }

    return {
      success: true,
      data: `data:image/${format};base64,${format === 'jpeg' ? MOCK_JPEG : MOCK_PNG}`,
      format,
      quality,
      selector,
      bounds: {
        x: 100,
        y: 200,
        width: 300 + (padding * 2),
        height: 150 + (padding * 2)
      },
      padding,
      type: 'element'
    };
  });

  // Area screenshot
  server.registerHandler('screenshot_area', async (params) => {
    const { x, y, width, height, format = 'png', quality = 100 } = params;

    if (x === undefined || y === undefined || !width || !height) {
      return { success: false, error: 'x, y, width, and height are required' };
    }

    return {
      success: true,
      data: `data:image/${format};base64,${format === 'jpeg' ? MOCK_JPEG : MOCK_PNG}`,
      format,
      quality,
      area: { x, y, width, height },
      type: 'area'
    };
  });

  // Annotate screenshot
  server.registerHandler('annotate_screenshot', async (params) => {
    const { data, annotations } = params;

    if (!data) {
      return { success: false, error: 'Screenshot data is required' };
    }

    if (!annotations || !Array.isArray(annotations)) {
      return { success: false, error: 'Annotations array is required' };
    }

    return {
      success: true,
      data: data, // In real implementation, this would be modified
      annotationsApplied: annotations.length,
      annotations: annotations.map((a, i) => ({
        ...a,
        id: `annotation-${i}`
      }))
    };
  });

  // Compare screenshots
  server.registerHandler('compare_screenshots', async (params) => {
    const { screenshot1, screenshot2, threshold = 0.1 } = params;

    if (!screenshot1 || !screenshot2) {
      return { success: false, error: 'Both screenshots are required' };
    }

    // Simulate comparison
    const difference = Math.random() * 0.5; // Random difference 0-50%
    const match = difference <= threshold;

    return {
      success: true,
      match,
      difference: difference,
      threshold,
      diffPixels: Math.round(difference * 1920 * 1080)
    };
  });

  // Save screenshot
  server.registerHandler('save_screenshot', async (params) => {
    const { data, path, filename } = params;

    if (!data) {
      return { success: false, error: 'Screenshot data is required' };
    }

    const finalPath = path || '/tmp';
    const finalFilename = filename || `screenshot-${Date.now()}.png`;

    return {
      success: true,
      path: `${finalPath}/${finalFilename}`,
      size: data.length
    };
  });
}

describe('Screenshot Test Scenarios', () => {
  beforeAll(async () => {
    server = new TestServer({ port: TEST_PORT });
    setupScreenshotHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  });

  afterAll(async () => {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  });

  describe('Basic Viewport Screenshot', () => {
    test('should capture viewport screenshot', async () => {
      const response = await extension.sendCommand('screenshot', {});

      expect(response.success).toBe(true);
      expect(response.result.data).toBeTruthy();
      expect(response.result.data.startsWith('data:image/')).toBe(true);
      expect(response.result.width).toBe(1920);
      expect(response.result.height).toBe(1080);
    });
  });

  describe('Screenshot Formats', () => {
    test('should capture PNG format', async () => {
      const pngResponse = await extension.sendCommand('screenshot', { format: 'png' });
      expect(pngResponse.success).toBe(true);
      expect(pngResponse.result.data).toContain('image/png');
      expect(pngResponse.result.format).toBe('png');
    });

    test('should capture JPEG format', async () => {
      const jpegResponse = await extension.sendCommand('screenshot', { format: 'jpeg' });
      expect(jpegResponse.success).toBe(true);
      expect(jpegResponse.result.data).toContain('image/jpeg');
    });

    test('should capture WebP format', async () => {
      const webpResponse = await extension.sendCommand('screenshot', { format: 'webp' });
      expect(webpResponse.success).toBe(true);
    });

    test('should reject invalid format', async () => {
      const invalidResponse = await extension.sendCommand('screenshot', { format: 'gif' });
      expect(invalidResponse.success).toBe(false);
    });
  });

  describe('Screenshot Quality', () => {
    test('should capture high quality screenshot', async () => {
      const highResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 100 });
      expect(highResponse.success).toBe(true);
      expect(highResponse.result.quality).toBe(100);
    });

    test('should capture medium quality screenshot', async () => {
      const medResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 50 });
      expect(medResponse.success).toBe(true);
      expect(medResponse.result.quality).toBe(50);
    });

    test('should capture low quality screenshot', async () => {
      const lowResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 10 });
      expect(lowResponse.success).toBe(true);
      expect(lowResponse.result.quality).toBe(10);
    });

    test('should reject invalid quality', async () => {
      const invalidResponse = await extension.sendCommand('screenshot', { quality: 150 });
      expect(invalidResponse.success).toBe(false);
    });
  });

  describe('Full Page Screenshot', () => {
    test('should capture full page screenshot', async () => {
      const response = await extension.sendCommand('screenshot_full_page', {});

      expect(response.success).toBe(true);
      expect(response.result.type).toBe('full_page');
      expect(response.result.height).toBeGreaterThan(response.result.width);
    });

    test('should have correct full page dimensions', async () => {
      const response = await extension.sendCommand('screenshot_full_page', {});

      expect(response.result.width).toBe(1920);
      expect(response.result.height).toBe(5000);
    });
  });

  describe('Element Screenshot', () => {
    test('should capture element screenshot', async () => {
      const response = await extension.sendCommand('screenshot_element', {
        selector: '#main-content'
      });

      expect(response.success).toBe(true);
      expect(response.result.type).toBe('element');
      expect(response.result.selector).toBe('#main-content');
      expect(response.result.bounds).toBeTruthy();
    });

    test('should capture element screenshot with padding', async () => {
      const paddedResponse = await extension.sendCommand('screenshot_element', {
        selector: '#header',
        padding: 10
      });
      expect(paddedResponse.success).toBe(true);
      expect(paddedResponse.result.padding).toBe(10);
    });

    test('should fail for nonexistent element', async () => {
      const notFoundResponse = await extension.sendCommand('screenshot_element', {
        selector: '#nonexistent'
      });
      expect(notFoundResponse.success).toBe(false);
    });
  });

  describe('Area Screenshot', () => {
    test('should capture area screenshot', async () => {
      const response = await extension.sendCommand('screenshot_area', {
        x: 100,
        y: 100,
        width: 500,
        height: 300
      });

      expect(response.success).toBe(true);
      expect(response.result.type).toBe('area');
      expect(response.result.area).toBeTruthy();
      expect(response.result.area.x).toBe(100);
      expect(response.result.area.width).toBe(500);
    });

    test('should reject missing parameters', async () => {
      const invalidResponse = await extension.sendCommand('screenshot_area', {
        x: 100,
        y: 100
        // Missing width and height
      });
      expect(invalidResponse.success).toBe(false);
    });
  });

  describe('Screenshot with Scale', () => {
    test('should capture 2x scale screenshot', async () => {
      const scale2Response = await extension.sendCommand('screenshot_viewport', {
        scale: 2
      });
      expect(scale2Response.success).toBe(true);
      expect(scale2Response.result.width).toBe(3840);
      expect(scale2Response.result.height).toBe(2160);
    });

    test('should capture 0.5x scale screenshot', async () => {
      const halfResponse = await extension.sendCommand('screenshot_viewport', {
        scale: 0.5
      });
      expect(halfResponse.success).toBe(true);
      expect(halfResponse.result.width).toBe(960);
    });
  });

  describe('Screenshot Annotation', () => {
    test('should annotate screenshot', async () => {
      const screenshot = await extension.sendCommand('screenshot', {});
      expect(screenshot.success).toBe(true);

      const annotations = [
        { type: 'rectangle', x: 100, y: 100, width: 200, height: 100, color: 'red' },
        { type: 'circle', x: 500, y: 300, radius: 50, color: 'blue' },
        { type: 'arrow', x1: 100, y1: 500, x2: 300, y2: 400, color: 'green' },
        { type: 'text', x: 400, y: 200, text: 'Important!', fontSize: 24 }
      ];

      const annotatedResponse = await extension.sendCommand('annotate_screenshot', {
        data: screenshot.result.data,
        annotations
      });

      expect(annotatedResponse.success).toBe(true);
      expect(annotatedResponse.result.annotationsApplied).toBe(4);
    });

    test('should assign IDs to annotations', async () => {
      const screenshot = await extension.sendCommand('screenshot', {});

      const annotatedResponse = await extension.sendCommand('annotate_screenshot', {
        data: screenshot.result.data,
        annotations: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }]
      });

      expect(annotatedResponse.result.annotations[0].id).toBeTruthy();
    });
  });

  describe('Screenshot Comparison', () => {
    test('should compare screenshots', async () => {
      const ss1 = await extension.sendCommand('screenshot', {});
      const ss2 = await extension.sendCommand('screenshot', {});

      const comparisonResponse = await extension.sendCommand('compare_screenshots', {
        screenshot1: ss1.result.data,
        screenshot2: ss2.result.data,
        threshold: 0.1
      });

      expect(comparisonResponse.success).toBe(true);
      expect('match' in comparisonResponse.result).toBe(true);
      expect('difference' in comparisonResponse.result).toBe(true);
    });

    test('should compare with strict threshold', async () => {
      const ss1 = await extension.sendCommand('screenshot', {});
      const ss2 = await extension.sendCommand('screenshot', {});

      const strictComparison = await extension.sendCommand('compare_screenshots', {
        screenshot1: ss1.result.data,
        screenshot2: ss2.result.data,
        threshold: 0.01
      });
      expect(strictComparison.success).toBe(true);
    });
  });

  describe('Screenshot Save', () => {
    test('should save screenshot with default path', async () => {
      const screenshot = await extension.sendCommand('screenshot', {});
      expect(screenshot.success).toBe(true);

      const saveResponse = await extension.sendCommand('save_screenshot', {
        data: screenshot.result.data
      });

      expect(saveResponse.success).toBe(true);
      expect(saveResponse.result.path).toBeTruthy();
      expect(saveResponse.result.path).toContain('.png');
    });

    test('should save screenshot with custom path', async () => {
      const screenshot = await extension.sendCommand('screenshot', {});

      const customSaveResponse = await extension.sendCommand('save_screenshot', {
        data: screenshot.result.data,
        path: '/custom/path',
        filename: 'my-screenshot.png'
      });

      expect(customSaveResponse.success).toBe(true);
      expect(customSaveResponse.result.path).toContain('/custom/path');
      expect(customSaveResponse.result.path).toContain('my-screenshot.png');
    });
  });

  describe('Complete Screenshot Flow', () => {
    test('should complete full screenshot workflow', async () => {
      // 1. Capture viewport screenshot
      const viewportResponse = await extension.sendCommand('screenshot', { format: 'png' });
      expect(viewportResponse.success).toBe(true);

      // 2. Capture full page screenshot
      const fullPageResponse = await extension.sendCommand('screenshot_full_page', {});
      expect(fullPageResponse.success).toBe(true);

      // 3. Capture element screenshot
      const elementResponse = await extension.sendCommand('screenshot_element', {
        selector: '#target-element'
      });
      expect(elementResponse.success).toBe(true);

      // 4. Annotate screenshot
      const annotateResponse = await extension.sendCommand('annotate_screenshot', {
        data: viewportResponse.result.data,
        annotations: [
          { type: 'rectangle', x: 100, y: 100, width: 200, height: 100, color: 'red' }
        ]
      });
      expect(annotateResponse.success).toBe(true);

      // 5. Save screenshot
      const saveResponse = await extension.sendCommand('save_screenshot', {
        data: annotateResponse.result.data,
        filename: 'final-screenshot.png'
      });
      expect(saveResponse.success).toBe(true);
    });
  });
});

// Export for external use
module.exports = { testUtils };

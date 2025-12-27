/**
 * Screenshot Test Scenarios
 *
 * Tests screenshot capture functionality between extension and browser.
 */

const assert = require('assert');
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
  async setup() {
    server = new TestServer({ port: TEST_PORT });
    setupScreenshotHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  },

  async teardown() {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  },

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

/**
 * Test Suite: Basic Viewport Screenshot
 */
async function testBasicViewportScreenshot() {
  console.log('\n--- Test: Basic Viewport Screenshot ---');

  const response = await extension.sendCommand('screenshot', {});

  assert(response.success, 'Screenshot should succeed');
  assert(response.result.data, 'Should return image data');
  assert(response.result.data.startsWith('data:image/'), 'Should be data URL');
  assert(response.result.width === 1920, 'Width should be 1920');
  assert(response.result.height === 1080, 'Height should be 1080');
  console.log('  Basic viewport screenshot captured');

  console.log('PASSED: Basic Viewport Screenshot');
  return true;
}

/**
 * Test Suite: Screenshot Formats
 */
async function testScreenshotFormats() {
  console.log('\n--- Test: Screenshot Formats ---');

  // PNG format
  const pngResponse = await extension.sendCommand('screenshot', { format: 'png' });
  assert(pngResponse.success, 'PNG screenshot should succeed');
  assert(pngResponse.result.data.includes('image/png'), 'Should be PNG format');
  assert(pngResponse.result.format === 'png', 'Format should be png');
  console.log('  PNG format works');

  // JPEG format
  const jpegResponse = await extension.sendCommand('screenshot', { format: 'jpeg' });
  assert(jpegResponse.success, 'JPEG screenshot should succeed');
  assert(jpegResponse.result.data.includes('image/jpeg'), 'Should be JPEG format');
  console.log('  JPEG format works');

  // WebP format
  const webpResponse = await extension.sendCommand('screenshot', { format: 'webp' });
  assert(webpResponse.success, 'WebP screenshot should succeed');
  console.log('  WebP format works');

  // Invalid format
  const invalidResponse = await extension.sendCommand('screenshot', { format: 'gif' });
  assert(!invalidResponse.success, 'Invalid format should fail');
  console.log('  Invalid format rejected');

  console.log('PASSED: Screenshot Formats');
  return true;
}

/**
 * Test Suite: Screenshot Quality
 */
async function testScreenshotQuality() {
  console.log('\n--- Test: Screenshot Quality ---');

  // High quality
  const highResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 100 });
  assert(highResponse.success, 'High quality should succeed');
  assert(highResponse.result.quality === 100, 'Quality should be 100');
  console.log('  High quality (100) works');

  // Medium quality
  const medResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 50 });
  assert(medResponse.success, 'Medium quality should succeed');
  assert(medResponse.result.quality === 50, 'Quality should be 50');
  console.log('  Medium quality (50) works');

  // Low quality
  const lowResponse = await extension.sendCommand('screenshot', { format: 'jpeg', quality: 10 });
  assert(lowResponse.success, 'Low quality should succeed');
  assert(lowResponse.result.quality === 10, 'Quality should be 10');
  console.log('  Low quality (10) works');

  // Invalid quality
  const invalidResponse = await extension.sendCommand('screenshot', { quality: 150 });
  assert(!invalidResponse.success, 'Invalid quality should fail');
  console.log('  Invalid quality rejected');

  console.log('PASSED: Screenshot Quality');
  return true;
}

/**
 * Test Suite: Full Page Screenshot
 */
async function testFullPageScreenshot() {
  console.log('\n--- Test: Full Page Screenshot ---');

  const response = await extension.sendCommand('screenshot_full_page', {});

  assert(response.success, 'Full page screenshot should succeed');
  assert(response.result.type === 'full_page', 'Type should be full_page');
  assert(response.result.height > response.result.width, 'Height should be greater than width for full page');
  console.log('  Full page screenshot captured');

  // Verify dimensions
  assert(response.result.width === 1920, 'Width should match viewport');
  assert(response.result.height === 5000, 'Height should be full page');
  console.log('  Full page dimensions correct');

  console.log('PASSED: Full Page Screenshot');
  return true;
}

/**
 * Test Suite: Element Screenshot
 */
async function testElementScreenshot() {
  console.log('\n--- Test: Element Screenshot ---');

  // Valid element
  const response = await extension.sendCommand('screenshot_element', {
    selector: '#main-content'
  });

  assert(response.success, 'Element screenshot should succeed');
  assert(response.result.type === 'element', 'Type should be element');
  assert(response.result.selector === '#main-content', 'Selector should match');
  assert(response.result.bounds, 'Should have bounds');
  console.log('  Element screenshot captured');

  // With padding
  const paddedResponse = await extension.sendCommand('screenshot_element', {
    selector: '#header',
    padding: 10
  });
  assert(paddedResponse.success, 'Padded screenshot should succeed');
  assert(paddedResponse.result.padding === 10, 'Padding should be 10');
  console.log('  Element screenshot with padding captured');

  // Nonexistent element
  const notFoundResponse = await extension.sendCommand('screenshot_element', {
    selector: '#nonexistent'
  });
  assert(!notFoundResponse.success, 'Nonexistent element should fail');
  console.log('  Nonexistent element rejected');

  console.log('PASSED: Element Screenshot');
  return true;
}

/**
 * Test Suite: Area Screenshot
 */
async function testAreaScreenshot() {
  console.log('\n--- Test: Area Screenshot ---');

  const response = await extension.sendCommand('screenshot_area', {
    x: 100,
    y: 100,
    width: 500,
    height: 300
  });

  assert(response.success, 'Area screenshot should succeed');
  assert(response.result.type === 'area', 'Type should be area');
  assert(response.result.area, 'Should have area info');
  assert(response.result.area.x === 100, 'X should match');
  assert(response.result.area.width === 500, 'Width should match');
  console.log('  Area screenshot captured');

  // Missing parameters
  const invalidResponse = await extension.sendCommand('screenshot_area', {
    x: 100,
    y: 100
    // Missing width and height
  });
  assert(!invalidResponse.success, 'Missing params should fail');
  console.log('  Missing parameters rejected');

  console.log('PASSED: Area Screenshot');
  return true;
}

/**
 * Test Suite: Screenshot with Scale
 */
async function testScreenshotWithScale() {
  console.log('\n--- Test: Screenshot with Scale ---');

  // 2x scale
  const scale2Response = await extension.sendCommand('screenshot_viewport', {
    scale: 2
  });
  assert(scale2Response.success, '2x scale should succeed');
  assert(scale2Response.result.width === 3840, 'Width should be doubled');
  assert(scale2Response.result.height === 2160, 'Height should be doubled');
  console.log('  2x scale screenshot captured');

  // 0.5x scale
  const halfResponse = await extension.sendCommand('screenshot_viewport', {
    scale: 0.5
  });
  assert(halfResponse.success, '0.5x scale should succeed');
  assert(halfResponse.result.width === 960, 'Width should be halved');
  console.log('  0.5x scale screenshot captured');

  console.log('PASSED: Screenshot with Scale');
  return true;
}

/**
 * Test Suite: Screenshot Annotation
 */
async function testScreenshotAnnotation() {
  console.log('\n--- Test: Screenshot Annotation ---');

  // First capture a screenshot
  const screenshot = await extension.sendCommand('screenshot', {});
  assert(screenshot.success, 'Screenshot should succeed');

  // Annotate with various types
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

  assert(annotatedResponse.success, 'Annotation should succeed');
  assert(annotatedResponse.result.annotationsApplied === 4, 'Should apply 4 annotations');
  console.log('  Added 4 annotations to screenshot');

  // Verify annotation IDs
  assert(annotatedResponse.result.annotations[0].id, 'Annotations should have IDs');
  console.log('  Annotations have IDs');

  console.log('PASSED: Screenshot Annotation');
  return true;
}

/**
 * Test Suite: Screenshot Comparison
 */
async function testScreenshotComparison() {
  console.log('\n--- Test: Screenshot Comparison ---');

  // Compare identical screenshots
  const ss1 = await extension.sendCommand('screenshot', {});
  const ss2 = await extension.sendCommand('screenshot', {});

  const comparisonResponse = await extension.sendCommand('compare_screenshots', {
    screenshot1: ss1.result.data,
    screenshot2: ss2.result.data,
    threshold: 0.1
  });

  assert(comparisonResponse.success, 'Comparison should succeed');
  assert('match' in comparisonResponse.result, 'Should have match result');
  assert('difference' in comparisonResponse.result, 'Should have difference');
  console.log('  Screenshots compared');

  // Compare with different threshold
  const strictComparison = await extension.sendCommand('compare_screenshots', {
    screenshot1: ss1.result.data,
    screenshot2: ss2.result.data,
    threshold: 0.01 // Very strict
  });
  assert(strictComparison.success, 'Strict comparison should succeed');
  console.log('  Strict threshold comparison works');

  console.log('PASSED: Screenshot Comparison');
  return true;
}

/**
 * Test Suite: Screenshot Save
 */
async function testScreenshotSave() {
  console.log('\n--- Test: Screenshot Save ---');

  const screenshot = await extension.sendCommand('screenshot', {});
  assert(screenshot.success, 'Screenshot should succeed');

  // Save with default path
  const saveResponse = await extension.sendCommand('save_screenshot', {
    data: screenshot.result.data
  });

  assert(saveResponse.success, 'Save should succeed');
  assert(saveResponse.result.path, 'Should return path');
  assert(saveResponse.result.path.includes('.png'), 'Should have extension');
  console.log('  Screenshot saved with default path');

  // Save with custom path
  const customSaveResponse = await extension.sendCommand('save_screenshot', {
    data: screenshot.result.data,
    path: '/custom/path',
    filename: 'my-screenshot.png'
  });

  assert(customSaveResponse.success, 'Custom save should succeed');
  assert(customSaveResponse.result.path.includes('/custom/path'), 'Should use custom path');
  assert(customSaveResponse.result.path.includes('my-screenshot.png'), 'Should use custom filename');
  console.log('  Screenshot saved with custom path');

  console.log('PASSED: Screenshot Save');
  return true;
}

/**
 * Test Suite: Complete Screenshot Flow
 */
async function testCompleteScreenshotFlow() {
  console.log('\n--- Test: Complete Screenshot Flow ---');

  // 1. Capture viewport screenshot
  const viewportResponse = await extension.sendCommand('screenshot', { format: 'png' });
  assert(viewportResponse.success, 'Viewport screenshot should succeed');
  console.log('  Step 1: Captured viewport screenshot');

  // 2. Capture full page screenshot
  const fullPageResponse = await extension.sendCommand('screenshot_full_page', {});
  assert(fullPageResponse.success, 'Full page screenshot should succeed');
  console.log('  Step 2: Captured full page screenshot');

  // 3. Capture element screenshot
  const elementResponse = await extension.sendCommand('screenshot_element', {
    selector: '#target-element'
  });
  assert(elementResponse.success, 'Element screenshot should succeed');
  console.log('  Step 3: Captured element screenshot');

  // 4. Annotate screenshot
  const annotateResponse = await extension.sendCommand('annotate_screenshot', {
    data: viewportResponse.result.data,
    annotations: [
      { type: 'rectangle', x: 100, y: 100, width: 200, height: 100, color: 'red' }
    ]
  });
  assert(annotateResponse.success, 'Annotation should succeed');
  console.log('  Step 4: Annotated screenshot');

  // 5. Save screenshot
  const saveResponse = await extension.sendCommand('save_screenshot', {
    data: annotateResponse.result.data,
    filename: 'final-screenshot.png'
  });
  assert(saveResponse.success, 'Save should succeed');
  console.log('  Step 5: Saved screenshot');

  console.log('PASSED: Complete Screenshot Flow');
  return true;
}

/**
 * Run all screenshot tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Screenshot Test Scenarios');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Basic Viewport Screenshot', fn: testBasicViewportScreenshot },
    { name: 'Screenshot Formats', fn: testScreenshotFormats },
    { name: 'Screenshot Quality', fn: testScreenshotQuality },
    { name: 'Full Page Screenshot', fn: testFullPageScreenshot },
    { name: 'Element Screenshot', fn: testElementScreenshot },
    { name: 'Area Screenshot', fn: testAreaScreenshot },
    { name: 'Screenshot with Scale', fn: testScreenshotWithScale },
    { name: 'Screenshot Annotation', fn: testScreenshotAnnotation },
    { name: 'Screenshot Comparison', fn: testScreenshotComparison },
    { name: 'Screenshot Save', fn: testScreenshotSave },
    { name: 'Complete Screenshot Flow', fn: testCompleteScreenshotFlow }
  ];

  try {
    await testUtils.setup();

    for (const test of tests) {
      try {
        await test.fn();
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
        console.log(`FAILED: ${test.name} - ${error.message}`);
      }
    }
  } finally {
    await testUtils.teardown();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Screenshot Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results.failed === 0;
}

// Export for external use
module.exports = { runTests, testUtils };

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

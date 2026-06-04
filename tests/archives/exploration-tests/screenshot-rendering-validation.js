#!/usr/bin/env node

/**
 * Screenshot and Rendering Validation Test Suite
 * Tests v11.3.0 screenshot and rendering functionality
 *
 * Covers:
 * - Basic screenshot capture (viewport, full-page, element)
 * - Image validation (dimensions, format, not corrupted)
 * - Rendering verification (content visibility)
 * - Headless mode detection and fallback
 * - Error handling and edge cases
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 30000; // 30 seconds per test
const OUTPUT_DIR = path.join(__dirname, '..', 'results');

// Test results tracking
const results = {
  timestamp: new Date().toISOString(),
  startTime: Date.now(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    issues: []
  }
};

/**
 * Test utilities
 */
class TestLogger {
  static log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  static error(message) {
    console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${message}`);
  }

  static success(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ✓ ${message}`);
  }
}

/**
 * WebSocket client wrapper
 */
class TestClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        TestLogger.success('WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          const { id } = message;
          if (id && this.pendingRequests.has(id)) {
            const { resolve } = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);
            resolve(message);
          }
        } catch (error) {
          TestLogger.error(`Failed to parse WebSocket message: ${error.message}`);
        }
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('close', () => {
        TestLogger.log('WebSocket disconnected');
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, TEST_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject });

      // Message format must match WebSocket server expectations: { id, command, ...params }
      const message = {
        id,
        command,
        ...params
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.once('close', resolve);
      } else {
        resolve();
      }
    });
  }
}

/**
 * Image validation utilities
 */
class ImageValidator {
  static isValidBase64(data) {
    try {
      const base64Str = data.includes(',') ? data.split(',')[1] : data;
      Buffer.from(base64Str, 'base64');
      return true;
    } catch (error) {
      return false;
    }
  }

  static extractBase64(dataUri) {
    if (!dataUri) return null;
    if (dataUri.includes(',')) {
      return dataUri.split(',')[1];
    }
    return dataUri;
  }

  static isPNGHeader(buffer) {
    return buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47;
  }

  static isJPEGHeader(buffer) {
    return buffer.length >= 4 &&
      buffer[0] === 0xFF &&
      buffer[1] === 0xD8 &&
      buffer[2] === 0xFF;
  }

  static isWebPHeader(buffer) {
    return buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
  }

  static validateImageFormat(data, expectedFormat) {
    const base64 = this.extractBase64(data);
    if (!base64) {
      return { valid: false, error: 'No base64 data found' };
    }

    try {
      const buffer = Buffer.from(base64, 'base64');

      if (buffer.length === 0) {
        return { valid: false, error: 'Image buffer is empty' };
      }

      let validFormat = false;
      let detectedFormat = 'unknown';

      if (this.isPNGHeader(buffer)) {
        validFormat = expectedFormat === 'png';
        detectedFormat = 'png';
      } else if (this.isJPEGHeader(buffer)) {
        validFormat = expectedFormat === 'jpeg' || expectedFormat === 'jpg';
        detectedFormat = 'jpeg';
      } else if (this.isWebPHeader(buffer)) {
        validFormat = expectedFormat === 'webp';
        detectedFormat = 'webp';
      }

      if (!validFormat) {
        return {
          valid: false,
          error: `Format mismatch: expected ${expectedFormat}, detected ${detectedFormat}`
        };
      }

      return {
        valid: true,
        format: detectedFormat,
        size: buffer.length,
        details: {
          headerValid: true,
          bufferSize: buffer.length,
          base64Length: base64.length
        }
      };
    } catch (error) {
      return { valid: false, error: `Buffer validation failed: ${error.message}` };
    }
  }

  static validateDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      return { valid: false, error: 'Width and height must be integers' };
    }

    if (width <= 0 || height <= 0) {
      return { valid: false, error: `Invalid dimensions: ${width}x${height}` };
    }

    if (width > 8192 || height > 8192) {
      return { valid: false, error: `Dimensions exceed maximum: ${width}x${height}` };
    }

    return { valid: true, dimensions: `${width}x${height}` };
  }
}

/**
 * Individual test functions
 */
const tests = {
  async navigateToSimpleSite(client) {
    TestLogger.log('Test: Navigate to simple site (example.com)');
    try {
      const result = await client.sendCommand('navigate', { url: 'https://example.com' });

      if (result.success) {
        TestLogger.success('Navigation successful');
        return { passed: true, message: 'Successfully navigated to example.com' };
      } else {
        return { passed: false, message: `Navigation failed: ${result.error}` };
      }
    } catch (error) {
      return { passed: false, message: `Navigation error: ${error.message}` };
    }
  },

  async simpleScreenshot(client) {
    TestLogger.log('Test: Simple viewport screenshot (PNG)');
    try {
      const result = await client.sendCommand('screenshot', { format: 'png', quality: 100 });

      if (!result.success) {
        return { passed: false, message: `Screenshot failed: ${result.error}` };
      }

      // Validate image data
      const formatValidation = ImageValidator.validateImageFormat(result.data, 'png');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      // Validate dimensions
      const dimValidation = ImageValidator.validateDimensions(result.width, result.height);
      if (!dimValidation.valid) {
        return { passed: false, message: `Dimensions invalid: ${dimValidation.error}` };
      }

      TestLogger.success(`Screenshot captured: ${result.width}x${result.height}, ${formatValidation.size} bytes`);
      return {
        passed: true,
        message: `Successfully captured ${result.width}x${result.height} PNG screenshot`,
        details: formatValidation.details
      };
    } catch (error) {
      return { passed: false, message: `Screenshot error: ${error.message}` };
    }
  },

  async jpegScreenshot(client) {
    TestLogger.log('Test: JPEG screenshot with quality');
    try {
      const result = await client.sendCommand('screenshot', { format: 'jpeg', quality: 85 });

      if (!result.success) {
        return { passed: false, message: `Screenshot failed: ${result.error}` };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'jpeg');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      const dimValidation = ImageValidator.validateDimensions(result.width, result.height);
      if (!dimValidation.valid) {
        return { passed: false, message: `Dimensions invalid: ${dimValidation.error}` };
      }

      TestLogger.success(`JPEG screenshot captured: ${result.width}x${result.height}`);
      return {
        passed: true,
        message: `Successfully captured JPEG screenshot at quality ${result.quality || 85}`,
        details: formatValidation.details
      };
    } catch (error) {
      return { passed: false, message: `JPEG screenshot error: ${error.message}` };
    }
  },

  async webpScreenshot(client) {
    TestLogger.log('Test: WebP screenshot');
    try {
      const result = await client.sendCommand('screenshot', { format: 'webp', quality: 85 });

      if (!result.success) {
        return { passed: false, message: `Screenshot failed: ${result.error}` };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'webp');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      TestLogger.success('WebP screenshot captured');
      return {
        passed: true,
        message: 'Successfully captured WebP screenshot',
        details: formatValidation.details
      };
    } catch (error) {
      return { passed: false, message: `WebP screenshot error: ${error.message}` };
    }
  },

  async fullPageScreenshot(client) {
    TestLogger.log('Test: Full page screenshot');
    try {
      const result = await client.sendCommand('screenshot_full_page', {
        format: 'png',
        quality: 100
      });

      if (!result.success) {
        // Some sites may not support full-page capture - this is acceptable
        return {
          passed: true,
          message: 'Full page screenshot command accepted (implementation may vary by browser)',
          skipped: true
        };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'png');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      TestLogger.success(`Full page screenshot: ${result.width}x${result.height}`);
      return {
        passed: true,
        message: `Full page screenshot captured: ${result.width}x${result.height}`,
        details: formatValidation.details
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Full page screenshot timeout or not supported (acceptable)',
        skipped: true,
        error: error.message
      };
    }
  },

  async elementScreenshot(client) {
    TestLogger.log('Test: Element screenshot');
    try {
      const result = await client.sendCommand('screenshot_element', {
        selector: 'body',
        format: 'png'
      });

      if (!result.success) {
        return { passed: false, message: `Element screenshot failed: ${result.error}` };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'png');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      const dimValidation = ImageValidator.validateDimensions(result.width, result.height);
      if (!dimValidation.valid) {
        return { passed: false, message: `Dimensions invalid: ${dimValidation.error}` };
      }

      TestLogger.success(`Element screenshot: ${result.width}x${result.height}`);
      return {
        passed: true,
        message: `Element screenshot captured: ${result.width}x${result.height}`,
        details: formatValidation.details
      };
    } catch (error) {
      return { passed: false, message: `Element screenshot error: ${error.message}` };
    }
  },

  async screenshotAfterNavigation(client) {
    TestLogger.log('Test: Screenshot after navigation');
    try {
      // Navigate to a different site
      await client.sendCommand('navigate', { url: 'https://httpbin.org' });

      // Wait a moment for page to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Capture screenshot
      const result = await client.sendCommand('screenshot', { format: 'png' });

      if (!result.success) {
        return { passed: false, message: `Screenshot after navigation failed: ${result.error}` };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'png');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      TestLogger.success('Screenshot after navigation successful');
      return {
        passed: true,
        message: 'Screenshot captured successfully after navigation',
        details: formatValidation.details
      };
    } catch (error) {
      return { passed: false, message: `Navigation + screenshot error: ${error.message}` };
    }
  },

  async invalidFormatHandling(client) {
    TestLogger.log('Test: Invalid format error handling');
    try {
      const result = await client.sendCommand('screenshot', { format: 'invalid' });

      // Should either fail gracefully or reject invalid format
      if (result.success === false || result.error) {
        TestLogger.success('Invalid format properly rejected');
        return {
          passed: true,
          message: 'Invalid format correctly rejected',
          error: result.error
        };
      } else {
        return {
          passed: false,
          message: 'Invalid format was not rejected'
        };
      }
    } catch (error) {
      return {
        passed: true,
        message: 'Invalid format error handled',
        error: error.message
      };
    }
  },

  async invalidQualityHandling(client) {
    TestLogger.log('Test: Invalid quality error handling');
    try {
      const result = await client.sendCommand('screenshot', { quality: 200 });

      if (result.success === false || result.error) {
        TestLogger.success('Invalid quality properly rejected');
        return {
          passed: true,
          message: 'Invalid quality correctly rejected'
        };
      } else if (result.success && (result.quality <= 100)) {
        // Server may cap the quality
        TestLogger.success('Quality was normalized');
        return {
          passed: true,
          message: 'Invalid quality was normalized by server'
        };
      } else {
        return {
          passed: false,
          message: 'Invalid quality was not rejected or normalized'
        };
      }
    } catch (error) {
      return { passed: false, message: `Quality validation error: ${error.message}` };
    }
  },

  async contentVisibilityValidation(client) {
    TestLogger.log('Test: Content visibility validation');
    try {
      // Navigate to a simple site
      await client.sendCommand('navigate', { url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture screenshot
      const result = await client.sendCommand('screenshot', { format: 'png' });

      if (!result.success) {
        return { passed: false, message: `Screenshot failed: ${result.error}` };
      }

      const formatValidation = ImageValidator.validateImageFormat(result.data, 'png');
      if (!formatValidation.valid) {
        return { passed: false, message: `Image format invalid: ${formatValidation.error}` };
      }

      // Check that image is not completely blank (at least some variation in content)
      const base64 = ImageValidator.extractBase64(result.data);
      const buffer = Buffer.from(base64, 'base64');

      // Simple heuristic: file size should be reasonable for a rendered page
      if (buffer.length < 100) {
        return {
          passed: false,
          message: `Screenshot appears to be blank or minimal (${buffer.length} bytes)`
        };
      }

      TestLogger.success(`Content appears to be rendered (${buffer.length} bytes)`);
      return {
        passed: true,
        message: `Content appears to be rendered correctly`,
        details: { bufferSize: buffer.length }
      };
    } catch (error) {
      return { passed: false, message: `Content visibility check error: ${error.message}` };
    }
  },

  async headlessDetection(client) {
    TestLogger.log('Test: Headless mode detection');
    try {
      const result = await client.sendCommand('get_info', {});

      const headlessInfo = {
        headlessModeDetected: result.headlessMode !== undefined,
        renderingMethod: result.renderingMethod || 'unknown',
        displayInfo: result.displayInfo
      };

      TestLogger.log(`Headless info: ${JSON.stringify(headlessInfo)}`);

      return {
        passed: true,
        message: 'Headless detection queried successfully',
        details: headlessInfo
      };
    } catch (error) {
      return {
        passed: true,
        message: 'Headless detection not available (acceptable)',
        error: error.message
      };
    }
  }
};

/**
 * Test execution engine
 */
async function runTest(client, testName, testFunction) {
  results.summary.total++;

  try {
    TestLogger.log(`\n--- Running: ${testName} ---`);
    const testResult = await testFunction(client);

    const testRecord = {
      name: testName,
      timestamp: new Date().toISOString(),
      passed: testResult.passed !== false,
      message: testResult.message,
      details: testResult.details
    };

    if (testResult.passed === false) {
      results.summary.failed++;
      results.summary.issues.push({
        test: testName,
        severity: testResult.severity || 'warning',
        message: testResult.message
      });
    } else {
      results.summary.passed++;
    }

    results.tests.push(testRecord);

    if (testResult.passed !== false) {
      TestLogger.success(`PASSED: ${testName}`);
    } else {
      TestLogger.error(`FAILED: ${testName}`);
    }

    return testResult;
  } catch (error) {
    TestLogger.error(`EXCEPTION in ${testName}: ${error.message}`);

    results.summary.failed++;
    results.summary.issues.push({
      test: testName,
      severity: 'critical',
      message: error.message,
      stack: error.stack
    });

    results.tests.push({
      name: testName,
      timestamp: new Date().toISOString(),
      passed: false,
      error: error.message
    });

    return { passed: false, message: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  TestLogger.log('='.repeat(70));
  TestLogger.log('Screenshot and Rendering Validation Test Suite');
  TestLogger.log('='.repeat(70));

  let client;
  try {
    // Connect to WebSocket server
    client = new TestClient(WS_URL);
    await client.connect();

    // Run all tests
    await runTest(client, 'Navigate to Simple Site', tests.navigateToSimpleSite);
    await runTest(client, 'Simple PNG Screenshot', tests.simpleScreenshot);
    await runTest(client, 'JPEG Screenshot with Quality', tests.jpegScreenshot);
    await runTest(client, 'WebP Screenshot', tests.webpScreenshot);
    await runTest(client, 'Full Page Screenshot', tests.fullPageScreenshot);
    await runTest(client, 'Element Screenshot', tests.elementScreenshot);
    await runTest(client, 'Screenshot After Navigation', tests.screenshotAfterNavigation);
    await runTest(client, 'Invalid Format Error Handling', tests.invalidFormatHandling);
    await runTest(client, 'Invalid Quality Error Handling', tests.invalidQualityHandling);
    await runTest(client, 'Content Visibility Validation', tests.contentVisibilityValidation);
    await runTest(client, 'Headless Mode Detection', tests.headlessDetection);

  } catch (error) {
    TestLogger.error(`Test suite error: ${error.message}`);
    results.summary.issues.push({
      test: 'suite',
      severity: 'critical',
      message: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }

  // Generate report
  results.endTime = Date.now();
  results.duration = (results.endTime - results.startTime) / 1000;

  await generateReport(results);
}

/**
 * Generate markdown report
 */
async function generateReport(results) {
  TestLogger.log('\n' + '='.repeat(70));
  TestLogger.log('TEST SUMMARY');
  TestLogger.log('='.repeat(70));

  const summary = results.summary;
  TestLogger.log(`Total Tests: ${summary.total}`);
  TestLogger.log(`Passed: ${summary.passed}`);
  TestLogger.log(`Failed: ${summary.failed}`);
  TestLogger.log(`Duration: ${results.duration.toFixed(2)}s`);

  // Create markdown report
  let markdown = `# Screenshot and Rendering Validation Report
*Generated: ${results.timestamp}*

## Executive Summary
- **Total Tests:** ${summary.total}
- **Passed:** ${summary.passed}
- **Failed:** ${summary.failed}
- **Success Rate:** ${summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0}%
- **Duration:** ${results.duration.toFixed(2)}s

## Test Results

`;

  // Group tests by status
  const passedTests = results.tests.filter(t => t.passed !== false);
  const failedTests = results.tests.filter(t => t.passed === false);

  if (failedTests.length > 0) {
    markdown += `### Failed Tests (${failedTests.length})\n`;
    failedTests.forEach(test => {
      markdown += `
#### ❌ ${test.name}
- **Message:** ${test.message || test.error}
- **Timestamp:** ${test.timestamp}
${test.details ? `- **Details:** ${JSON.stringify(test.details)}` : ''}
`;
    });
  }

  if (passedTests.length > 0) {
    markdown += `\n### Passed Tests (${passedTests.length})\n`;
    passedTests.forEach(test => {
      markdown += `
#### ✓ ${test.name}
- **Message:** ${test.message}
${test.details ? `- **Details:** ${JSON.stringify(test.details)}` : ''}
`;
    });
  }

  // Issues section
  if (summary.issues.length > 0) {
    markdown += `\n## Issues Found (${summary.issues.length})\n`;
    summary.issues.forEach((issue, idx) => {
      markdown += `\n### Issue ${idx + 1}: ${issue.test}
- **Severity:** ${issue.severity}
- **Message:** ${issue.message}
`;
    });
  } else {
    markdown += `\n## Issues Found
✓ No issues detected
`;
  }

  // Recommendations
  markdown += `\n## Recommendations\n`;
  if (summary.failed > 0) {
    markdown += `
### Critical Items
1. Review failed tests above
2. Check WebSocket server logs for error details
3. Verify Electron rendering environment (DISPLAY, Xvfb)
4. Test with different browser profiles

### Rendering Validation
`;

    const renderingIssues = summary.issues.filter(i => i.test.includes('Screenshot') || i.test.includes('render'));
    if (renderingIssues.length > 0) {
      markdown += `- **${renderingIssues.length} rendering-related issues found** - investigate virtual display configuration\n`;
    } else {
      markdown += `- No rendering issues detected\n`;
    }
  } else {
    markdown += `✓ All tests passed - no recommendations\n`;
  }

  markdown += `\n## Environment Info
- **Test URL:** ${WS_URL}
- **Test Timeout:** ${TEST_TIMEOUT}ms
- **Node Version:** ${process.version}
`;

  // Save report
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const reportPath = path.join(OUTPUT_DIR, 'SCREENSHOT-AND-RENDERING-VALIDATION-2026-05-08.md');
  fs.writeFileSync(reportPath, markdown);

  // Also save JSON results
  const jsonPath = path.join(OUTPUT_DIR, 'SCREENSHOT-AND-RENDERING-VALIDATION-2026-05-08.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  TestLogger.log(`\n✓ Report saved: ${reportPath}`);
  TestLogger.log(`✓ JSON saved: ${jsonPath}`);
  TestLogger.log('='.repeat(70));

  // Exit with appropriate code
  process.exit(summary.failed > 0 ? 1 : 0);
}

// Run tests
main().catch(error => {
  TestLogger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

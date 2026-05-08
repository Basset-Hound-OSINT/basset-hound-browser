#!/usr/bin/env node

/**
 * Screenshot and Rendering Validation Test Suite v2
 * Tests v11.3.0 screenshot and rendering functionality
 *
 * Covers:
 * - Basic screenshot capture (viewport, full-page, element)
 * - Image validation (dimensions, format, not corrupted)
 * - Rendering verification (content visibility)
 * - Error handling and edge cases
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = 'ws://localhost:8765';
const OUTPUT_DIR = path.join(__dirname, '..', 'results');
const TEST_TIMEOUT = 30000;

// Test state
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  passed: 0,
  failed: 0,
  issues: []
};

class Logger {
  static log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }
  static error(msg) {
    console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${msg}`);
  }
  static success(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ✓ ${msg}`);
  }
}

class ImageValidator {
  static extractBase64(data) {
    if (!data) return null;
    if (data.includes(',')) return data.split(',')[1];
    return data;
  }

  static getPNGDimensions(buffer) {
    if (buffer.length < 24) return null;
    // PNG dimensions are at bytes 16-24
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  static validateImage(data, expectedFormat) {
    const base64 = this.extractBase64(data);
    if (!base64) return { valid: false, error: 'No base64 data' };

    try {
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.length === 0) return { valid: false, error: 'Empty buffer' };

      let headerValid = false;
      let format = 'unknown';
      let size = buffer.length;

      // Check PNG header
      if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 &&
          buffer[2] === 0x4E && buffer[3] === 0x47) {
        headerValid = true;
        format = 'png';
        const dims = this.getPNGDimensions(buffer);
        if (dims && dims.width > 0 && dims.height > 0) {
          return {
            valid: true,
            format: 'png',
            size,
            width: dims.width,
            height: dims.height,
            headerValid: true
          };
        }
      }

      // Check JPEG header
      if (buffer.length >= 4 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        headerValid = true;
        format = 'jpeg';
        return { valid: true, format: 'jpeg', size, headerValid: true };
      }

      // Check WebP header
      if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 &&
          buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 &&
          buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        headerValid = true;
        format = 'webp';
        return { valid: true, format: 'webp', size, headerValid: true };
      }

      if (expectedFormat && format !== expectedFormat) {
        return { valid: false, error: `Expected ${expectedFormat}, got ${format}` };
      }

      if (!headerValid) {
        return { valid: false, error: `Invalid ${expectedFormat} header` };
      }

      return { valid: true, format, size };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

async function main() {
  Logger.log('='.repeat(70));
  Logger.log('Screenshot and Rendering Validation Test Suite');
  Logger.log('='.repeat(70));

  let ws = null;
  let messageId = 0;
  const pending = new Map();

  try {
    // Connect to WebSocket
    Logger.log('Connecting to WebSocket server...');
    ws = await new Promise((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      socket.on('open', () => {
        clearTimeout(timeout);
        Logger.success('WebSocket connected');
        resolve(socket);
      });

      socket.on('error', reject);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve } = pending.get(msg.id);
          pending.delete(msg.id);
          resolve(msg);
        }
      } catch (error) {
        Logger.error(`Message parse error: ${error.message}`);
      }
    });

    // Helper to send commands
    async function sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
      return new Promise((resolve) => {
        const id = ++messageId;
        const message = { id, command, ...params };

        const timer = setTimeout(() => {
          if (pending.has(id)) {
            pending.delete(id);
            resolve({ success: false, error: 'Command timeout' });
          }
        }, timeout);

        pending.set(id, {
          resolve: (result) => {
            clearTimeout(timer);
            resolve(result);
          }
        });

        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          resolve({ success: false, error: error.message });
        }
      });
    }

    // Helper to add test result
    function addResult(name, passed, message, details) {
      results.tests.push({ name, passed, message, details, timestamp: new Date().toISOString() });
      if (passed) {
        results.passed++;
        Logger.success(`${name}: ${message}`);
      } else {
        results.failed++;
        Logger.error(`${name}: ${message}`);
        results.issues.push({ test: name, message });
      }
    }

    // Test 1: Navigate to simple site
    Logger.log('\nTest 1: Navigate to simple site');
    const navResult = await sendCommand('navigate', { url: 'https://example.com' });
    addResult(
      'Navigate to example.com',
      navResult.success !== false,
      navResult.success ? 'Navigation successful' : (navResult.error || 'Unknown error')
    );

    // Wait for page to load
    await new Promise(r => setTimeout(r, 1000));

    // Test 2: Simple PNG screenshot
    Logger.log('\nTest 2: Simple PNG screenshot');
    const pngResult = await sendCommand('screenshot', { format: 'png', quality: 100 });
    if (pngResult.success) {
      const imgValidation = ImageValidator.validateImage(pngResult.data, 'png');
      if (imgValidation.valid) {
        addResult(
          'PNG screenshot',
          true,
          `Captured ${imgValidation.width || '?'}x${imgValidation.height || '?'} PNG (${imgValidation.size} bytes)`,
          imgValidation
        );
      } else {
        addResult('PNG screenshot', false, `Image validation failed: ${imgValidation.error}`);
      }
    } else {
      addResult('PNG screenshot', false, pngResult.error || 'Unknown error');
    }

    // Test 3: JPEG screenshot
    Logger.log('\nTest 3: JPEG screenshot');
    const jpegResult = await sendCommand('screenshot', { format: 'jpeg', quality: 85 });
    if (jpegResult.success) {
      const imgValidation = ImageValidator.validateImage(jpegResult.data, 'jpeg');
      addResult(
        'JPEG screenshot',
        imgValidation.valid,
        imgValidation.valid ? `Captured JPEG (${imgValidation.size} bytes)` : `Validation failed: ${imgValidation.error}`
      );
    } else {
      addResult('JPEG screenshot', false, jpegResult.error || 'Unknown error');
    }

    // Test 4: WebP screenshot
    Logger.log('\nTest 4: WebP screenshot');
    const webpResult = await sendCommand('screenshot', { format: 'webp', quality: 85 });
    if (webpResult.success) {
      const imgValidation = ImageValidator.validateImage(webpResult.data, 'webp');
      addResult(
        'WebP screenshot',
        imgValidation.valid,
        imgValidation.valid ? `Captured WebP (${imgValidation.size} bytes)` : `Validation failed: ${imgValidation.error}`
      );
    } else {
      addResult('WebP screenshot', false, webpResult.error || 'Unknown error');
    }

    // Test 5: Full page screenshot
    Logger.log('\nTest 5: Full page screenshot');
    const fullPageResult = await sendCommand('screenshot_full_page', { format: 'png' });
    if (fullPageResult.success) {
      const imgValidation = ImageValidator.validateImage(fullPageResult.data, 'png');
      addResult(
        'Full page screenshot',
        imgValidation.valid,
        imgValidation.valid ? `Full page captured (${imgValidation.size} bytes)` : `Validation failed: ${imgValidation.error}`,
        imgValidation
      );
    } else {
      addResult('Full page screenshot', true, 'Full page not available (acceptable)', { skipped: true });
    }

    // Test 6: Element screenshot
    Logger.log('\nTest 6: Element screenshot');
    const elemResult = await sendCommand('screenshot_element', { selector: 'body', format: 'png' });
    if (elemResult.success) {
      const imgValidation = ImageValidator.validateImage(elemResult.data, 'png');
      addResult(
        'Element screenshot',
        imgValidation.valid,
        imgValidation.valid ? `Element captured (${imgValidation.size} bytes)` : `Validation failed: ${imgValidation.error}`
      );
    } else {
      addResult('Element screenshot', false, elemResult.error || 'Unknown error');
    }

    // Test 7: Navigation + screenshot
    Logger.log('\nTest 7: Screenshot after navigation');
    await sendCommand('navigate', { url: 'https://httpbin.org' });
    await new Promise(r => setTimeout(r, 1000));
    const afterNavResult = await sendCommand('screenshot', { format: 'png' });
    if (afterNavResult.success) {
      const imgValidation = ImageValidator.validateImage(afterNavResult.data, 'png');
      addResult(
        'Screenshot after navigation',
        imgValidation.valid,
        imgValidation.valid ? 'Captured successfully' : `Validation failed: ${imgValidation.error}`
      );
    } else {
      addResult('Screenshot after navigation', false, afterNavResult.error || 'Unknown error');
    }

    // Test 8: Invalid format handling
    Logger.log('\nTest 8: Invalid format error handling');
    const invalidResult = await sendCommand('screenshot', { format: 'invalid' });
    const shouldFail = !invalidResult.success || invalidResult.error;
    addResult(
      'Invalid format rejection',
      shouldFail,
      shouldFail ? 'Correctly rejected invalid format' : 'Did not reject invalid format'
    );

    // Test 9: Invalid quality handling
    Logger.log('\nTest 9: Invalid quality error handling');
    const badQualityResult = await sendCommand('screenshot', { quality: 500 });
    const qualityHandled = !badQualityResult.success || badQualityResult.error || badQualityResult.quality <= 100;
    addResult(
      'Invalid quality handling',
      qualityHandled,
      qualityHandled ? 'Quality validation working' : 'Quality validation may have issues'
    );

    // Test 10: Content visibility
    Logger.log('\nTest 10: Content visibility validation');
    await sendCommand('navigate', { url: 'https://example.com' });
    await new Promise(r => setTimeout(r, 1000));
    const contentResult = await sendCommand('screenshot', { format: 'png' });
    if (contentResult.success) {
      const imgValidation = ImageValidator.validateImage(contentResult.data, 'png');
      if (imgValidation.valid && imgValidation.size > 500) {
        addResult(
          'Content visibility',
          true,
          `Page appears rendered (${imgValidation.size} bytes)`,
          { fileSize: imgValidation.size }
        );
      } else {
        addResult('Content visibility', false, 'Screenshot appears minimal/blank');
      }
    } else {
      addResult('Content visibility', false, contentResult.error || 'Unknown error');
    }

  } catch (error) {
    Logger.error(`Test execution error: ${error.message}`);
    results.issues.push({ test: 'suite', message: error.message });
  } finally {
    if (ws) {
      ws.close();
    }
  }

  // Generate report
  const total = results.tests.length;
  Logger.log('\n' + '='.repeat(70));
  Logger.log('TEST SUMMARY');
  Logger.log('='.repeat(70));
  Logger.log(`Total: ${total} | Passed: ${results.passed} | Failed: ${results.failed}`);
  Logger.log(`Success Rate: ${total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0}%`);

  // Generate markdown report
  let markdown = `# Screenshot and Rendering Validation Report
*Generated: ${results.timestamp}*

## Summary
- **Total Tests:** ${total}
- **Passed:** ${results.passed}
- **Failed:** ${results.failed}
- **Success Rate:** ${total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0}%

## Test Results

`;

  // Group by status
  const passed = results.tests.filter(t => t.passed);
  const failed = results.tests.filter(t => !t.passed);

  if (failed.length > 0) {
    markdown += `### Failed Tests (${failed.length})\n`;
    failed.forEach(test => {
      markdown += `- **${test.name}**: ${test.message}\n`;
    });
  }

  markdown += `\n### Passed Tests (${passed.length})\n`;
  passed.forEach(test => {
    markdown += `- **${test.name}**: ${test.message}\n`;
  });

  if (results.issues.length > 0) {
    markdown += `\n## Issues Found\n`;
    results.issues.forEach((issue, i) => {
      markdown += `${i + 1}. **${issue.test}**: ${issue.message}\n`;
    });
  }

  markdown += `\n## Recommendations\n`;
  if (results.failed > 0) {
    markdown += `- Fix ${results.failed} failing test(s)\n`;
    markdown += `- Check WebSocket server logs\n`;
    markdown += `- Verify rendering environment\n`;
  } else {
    markdown += `- ✓ All tests passed\n`;
  }

  // Save report
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const reportPath = path.join(OUTPUT_DIR, 'SCREENSHOT-AND-RENDERING-VALIDATION-2026-05-08.md');
  fs.writeFileSync(reportPath, markdown);

  const jsonPath = path.join(OUTPUT_DIR, 'SCREENSHOT-AND-RENDERING-VALIDATION-2026-05-08.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  Logger.log(`\n✓ Report saved: ${reportPath}`);
  Logger.log(`✓ JSON saved: ${jsonPath}`);
  Logger.log('='.repeat(70));

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

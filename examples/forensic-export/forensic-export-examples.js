/**
 * Basset Hound Browser - Forensic Export Commands Examples
 *
 * Examples of how to use the four new forensic export commands:
 * - export_raw_html
 * - export_network_log
 * - export_device_ids
 * - modify_element
 *
 * @example
 * const client = new WebSocket('ws://localhost:8765');
 * // Use examples below to interact with forensic export features
 */

// Helper function to send WebSocket commands
async function sendCommand(ws, command) {
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.id === command.id || response.command === command.command) {
          ws.removeEventListener('message', handler);
          resolve(response);
        }
      } catch (error) {
        reject(error);
      }
    };

    ws.addEventListener('message', handler);
    ws.send(JSON.stringify(command));

    // Timeout after 30 seconds
    setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error('Command timeout'));
    }, 30000);
  });
}

// ============================================
// Example 1: export_raw_html
// ============================================

/**
 * Example: Capture full page HTML with HTTP headers
 * Useful for: Forensic analysis, content verification, historical archival
 */
async function example_exportRawHtml(ws) {
  console.log('\n=== Example 1: export_raw_html ===\n');

  try {
    const result = await sendCommand(ws, {
      command: 'export_raw_html',
      id: 'export_raw_html_1'
    });

    if (result.success) {
      console.log(`Page URL: ${result.url}`);
      console.log(`Status Code: ${result.statusCode}`);
      console.log(`Content-Type: ${result.contentType}`);
      console.log(`HTML Length: ${result.htmlLength} bytes`);
      console.log(`Response Headers:`, JSON.stringify(result.responseHeaders, null, 2));

      // Save to file (Node.js example)
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        fs.writeFileSync('captured-page.html', result.html);
        console.log('\nHTML saved to: captured-page.html');
      }
    } else {
      console.error('Export failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================
// Example 2: export_network_log
// ============================================

/**
 * Example: Export all network requests with filtering and statistics
 * Useful for: Network analysis, performance profiling, security auditing
 */
async function example_exportNetworkLog(ws) {
  console.log('\n=== Example 2: export_network_log ===\n');

  try {
    // Example 2a: Get all requests
    console.log('--- All Requests ---');
    const allRequests = await sendCommand(ws, {
      command: 'export_network_log',
      format: 'json',
      id: 'export_network_log_all'
    });

    if (allRequests.success) {
      console.log(`Total Requests: ${allRequests.totalRequests}`);
      console.log(`Total Size: ${(allRequests.statistics.totalSize / 1024).toFixed(2)} KB`);
      console.log(`Total Duration: ${allRequests.statistics.totalDuration}ms`);

      console.log('\nRequests by Type:');
      for (const [type, data] of Object.entries(allRequests.statistics.byResourceType)) {
        console.log(`  ${type}: ${data.count} requests, ${(data.totalSize / 1024).toFixed(2)} KB, ${data.totalDuration}ms`);
      }

      console.log('\nRequests by Status Code:');
      for (const [status, count] of Object.entries(allRequests.statistics.byStatusCode)) {
        console.log(`  ${status}: ${count} requests`);
      }

      if (allRequests.statistics.slowestRequest) {
        console.log(`\nSlowest Request: ${allRequests.statistics.slowestRequest.url}`);
        console.log(`  Duration: ${allRequests.statistics.slowestRequest.duration}ms`);
      }

      if (allRequests.statistics.largestRequest) {
        console.log(`\nLargest Request: ${allRequests.statistics.largestRequest.url}`);
        console.log(`  Size: ${(allRequests.statistics.largestRequest.contentLength / 1024).toFixed(2)} KB`);
      }
    }

    // Example 2b: Filter by resource type
    console.log('\n--- XHR Requests Only ---');
    const xhrRequests = await sendCommand(ws, {
      command: 'export_network_log',
      resourceType: 'xhr',
      id: 'export_network_log_xhr'
    });

    if (xhrRequests.success) {
      console.log(`XHR Requests: ${xhrRequests.totalRequests}`);
      xhrRequests.requests.forEach(req => {
        console.log(`  ${req.method} ${req.url} -> ${req.statusCode} (${req.duration}ms)`);
      });
    }

    // Example 2c: Filter by duration
    console.log('\n--- Slow Requests (>500ms) ---');
    const slowRequests = await sendCommand(ws, {
      command: 'export_network_log',
      minDuration: 500,
      id: 'export_network_log_slow'
    });

    if (slowRequests.success) {
      console.log(`Slow Requests: ${slowRequests.totalRequests}`);
      slowRequests.requests.slice(0, 5).forEach(req => {
        console.log(`  ${req.url}: ${req.duration}ms`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================
// Example 3: export_device_ids
// ============================================

/**
 * Example: Export device fingerprints and browser identifiers
 * Useful for: Evasion verification, fingerprint profiling, device auditing
 */
async function example_exportDeviceIds(ws) {
  console.log('\n=== Example 3: export_device_ids ===\n');

  try {
    const result = await sendCommand(ws, {
      command: 'export_device_ids',
      id: 'export_device_ids_1'
    });

    if (result.success) {
      console.log('Device Identifiers:');
      console.log(`  User Agent: ${result.deviceIdentifiers.userAgent}`);
      console.log(`  Platform: ${result.deviceIdentifiers.platform}`);
      console.log(`  Hardware Cores: ${result.deviceIdentifiers.hardwareConcurrency}`);
      console.log(`  Device Memory: ${result.deviceIdentifiers.deviceMemory} GB`);
      console.log(`  Language: ${result.deviceIdentifiers.language}`);
      console.log(`  Timezone Offset: ${result.deviceIdentifiers.timezone} minutes`);
      console.log(`  WebDriver: ${result.deviceIdentifiers.webdriver}`);

      console.log('\nScreen Info:');
      const screen = result.deviceIdentifiers.screen;
      console.log(`  Resolution: ${screen.width}x${screen.height}`);
      console.log(`  Color Depth: ${screen.colorDepth} bits`);
      console.log(`  Orientation: ${screen.orientation}`);

      console.log('\nFingerprint Data:');
      if (result.fingerprint.canvas) {
        console.log(`  Canvas Hash: ${result.fingerprint.canvas.hash}`);
      }
      if (result.fingerprint.webgl) {
        console.log(`  WebGL Hash: ${result.fingerprint.webgl.hash}`);
        console.log(`  WebGL Renderer: ${result.fingerprint.webgl.renderer}`);
      }
      if (result.fingerprint.webrtc) {
        console.log(`  WebRTC IPv4: ${result.fingerprint.webrtc.ipv4}`);
      }

      console.log('\nStorage:');
      const storage = result.fingerprint.storage;
      console.log(`  localStorage items: ${storage.localStorage}`);
      console.log(`  sessionStorage items: ${storage.sessionStorage}`);
      console.log(`  indexedDB available: ${storage.indexedDB}`);

      if (result.proxyInfo) {
        console.log('\nProxy Configuration:');
        console.log(`  Proxy Enabled: ${result.proxyInfo.enabled}`);
        if (result.proxyInfo.currentProxy) {
          console.log(`  Current Proxy: ${result.proxyInfo.currentProxy.host}:${result.proxyInfo.currentProxy.port}`);
        }
        console.log(`  Rotation Mode: ${result.proxyInfo.rotationMode}`);
      }
    } else {
      console.error('Export failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================
// Example 4: modify_element
// ============================================

/**
 * Example: Modify DOM elements for testing and verification
 * Useful for: Testing, evasion verification, content manipulation
 */
async function example_modifyElement(ws) {
  console.log('\n=== Example 4: modify_element ===\n');

  try {
    // Example 4a: Modify text content
    console.log('--- Modifying Text Content ---');
    const textResult = await sendCommand(ws, {
      command: 'modify_element',
      selector: 'h1',
      type: 'text',
      value: 'Modified Title',
      allMatches: false,
      id: 'modify_text_1'
    });

    if (textResult.success) {
      console.log(`Matched: ${textResult.matched}, Modified: ${textResult.modified}`);
    } else {
      console.log(`Error: ${textResult.error}`);
    }

    // Example 4b: Modify attributes
    console.log('\n--- Modifying Attributes ---');
    const attrResult = await sendCommand(ws, {
      command: 'modify_element',
      selector: 'input[type="email"]',
      type: 'attribute',
      attributeName: 'placeholder',
      value: 'Enter your email address',
      id: 'modify_attr_1'
    });

    if (attrResult.success) {
      console.log(`Matched: ${attrResult.matched}, Modified: ${attrResult.modified}`);
    } else {
      console.log(`Error: ${attrResult.error}`);
    }

    // Example 4c: Add classes
    console.log('\n--- Adding CSS Classes ---');
    const classResult = await sendCommand(ws, {
      command: 'modify_element',
      selector: 'button.submit',
      type: 'class',
      classOperation: 'add',
      className: 'test-marked',
      id: 'modify_class_1'
    });

    if (classResult.success) {
      console.log(`Matched: ${classResult.matched}, Modified: ${classResult.modified}`);
    } else {
      console.log(`Error: ${classResult.error}`);
    }

    // Example 4d: Apply CSS styles
    console.log('\n--- Applying CSS Styles ---');
    const cssResult = await sendCommand(ws, {
      command: 'modify_element',
      selector: '.tracking-pixel',
      type: 'css',
      cssProperties: {
        'display': 'none',
        'visibility': 'hidden',
        'width': '0px',
        'height': '0px'
      },
      id: 'modify_css_1'
    });

    if (cssResult.success) {
      console.log(`Matched: ${cssResult.matched}, Modified: ${cssResult.modified}`);
    } else {
      console.log(`Error: ${cssResult.error}`);
    }

    // Example 4e: Modify HTML
    console.log('\n--- Modifying HTML Content ---');
    const htmlResult = await sendCommand(ws, {
      command: 'modify_element',
      selector: '#notice',
      type: 'html',
      value: '<div class="alert alert-info">This is a test notice</div>',
      allMatches: false,
      id: 'modify_html_1'
    });

    if (htmlResult.success) {
      console.log(`Matched: ${htmlResult.matched}, Modified: ${htmlResult.modified}`);
    } else {
      console.log(`Error: ${htmlResult.error}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// ============================================
// Advanced Example: Complete Forensic Workflow
// ============================================

/**
 * Complete forensic workflow: Navigate, capture, and analyze
 * Demonstrates using all four commands together
 */
async function example_completForensicWorkflow(ws) {
  console.log('\n=== Complete Forensic Workflow ===\n');

  try {
    // Step 1: Navigate to a page
    console.log('Step 1: Navigating to page...');
    await sendCommand(ws, {
      command: 'navigate',
      url: 'https://example.com',
      id: 'navigate_1'
    });

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Export device identifiers
    console.log('Step 2: Exporting device identifiers...');
    const deviceData = await sendCommand(ws, {
      command: 'export_device_ids',
      id: 'device_ids_1'
    });
    console.log(`Device captured: ${deviceData.deviceIdentifiers.userAgent.substring(0, 50)}...`);

    // Step 3: Capture network log
    console.log('Step 3: Capturing network log...');
    const networkData = await sendCommand(ws, {
      command: 'export_network_log',
      id: 'network_log_1'
    });
    console.log(`Network requests captured: ${networkData.totalRequests}`);

    // Step 4: Export full HTML
    console.log('Step 4: Exporting full HTML...');
    const htmlData = await sendCommand(ws, {
      command: 'export_raw_html',
      id: 'raw_html_1'
    });
    console.log(`HTML captured: ${htmlData.htmlLength} bytes (${htmlData.statusCode})`);

    // Step 5: Modify elements for verification
    console.log('Step 5: Modifying elements...');
    const modifyData = await sendCommand(ws, {
      command: 'modify_element',
      selector: 'body',
      type: 'class',
      classOperation: 'add',
      className: 'forensic-capture-complete',
      id: 'modify_1'
    });
    console.log(`Elements modified: ${modifyData.modified}`);

    // Step 6: Summary
    console.log('\n=== Forensic Capture Complete ===');
    console.log(`Timestamp: ${deviceData.timestamp}`);
    console.log(`Page URL: ${htmlData.url}`);
    console.log(`HTTP Status: ${htmlData.statusCode}`);
    console.log(`HTML Size: ${(htmlData.htmlLength / 1024).toFixed(2)} KB`);
    console.log(`Network Requests: ${networkData.totalRequests}`);
    console.log(`Total Data: ${(networkData.statistics.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Device User Agent: ${deviceData.deviceIdentifiers.userAgent.substring(0, 70)}...`);

  } catch (error) {
    console.error('Workflow error:', error.message);
  }
}

// ============================================
// Export all examples
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    example_exportRawHtml,
    example_exportNetworkLog,
    example_exportDeviceIds,
    example_modifyElement,
    example_completForensicWorkflow,
    sendCommand
  };
}

// ============================================
// Usage Instructions
// ============================================

/*
 * USAGE:
 *
 * 1. In a Node.js environment:
 *    const WebSocket = require('ws');
 *    const ws = new WebSocket('ws://localhost:8765');
 *    const examples = require('./forensic-export-examples');
 *
 *    ws.onopen = async () => {
 *      await examples.example_exportRawHtml(ws);
 *      await examples.example_exportNetworkLog(ws);
 *      await examples.example_exportDeviceIds(ws);
 *      await examples.example_modifyElement(ws);
 *      ws.close();
 *    };
 *
 * 2. In a browser environment:
 *    <script src="forensic-export-examples.js"></script>
 *    <script>
 *      const ws = new WebSocket('ws://localhost:8765');
 *      ws.onopen = async () => {
 *        await example_exportRawHtml(ws);
 *        await example_exportNetworkLog(ws);
 *        await example_exportDeviceIds(ws);
 *        await example_modifyElement(ws);
 *        ws.close();
 *      };
 *    </script>
 *
 * 3. For complete forensic workflow:
 *    await example_completForensicWorkflow(ws);
 */

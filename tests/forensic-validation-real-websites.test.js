/**
 * Forensic Export Commands - Real Website Validation Tests
 *
 * Validates forensic commands against actual websites:
 * 1. Google Search (https://www.google.com/search?q=basset+hound)
 * 2. Wikipedia (https://en.wikipedia.org/wiki/Basset_Hound)
 * 3. GitHub (https://github.com)
 *
 * Tests:
 * - export_raw_html: HTML completeness, headers, status codes
 * - export_network_log: Request capture (10+), statistics accuracy
 * - export_device_ids: User agent, fingerprints, device identifiers
 * - modify_element: Element modification capabilities
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = 'ws://localhost:8765';
const TIMEOUT = 30000; // 30 second timeout per command
const RESULTS_DIR = path.join(__dirname, '..', 'tests', 'results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Test websites
const TEST_SITES = [
  {
    name: 'Google Search',
    url: 'https://www.google.com/search?q=basset+hound',
    expectedContentIndicators: ['search', 'google', 'basset', 'hound']
  },
  {
    name: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Basset_Hound',
    expectedContentIndicators: ['Basset', 'Hound', 'Wikipedia', 'dog']
  },
  {
    name: 'GitHub',
    url: 'https://github.com',
    expectedContentIndicators: ['github', 'code', 'repository']
  }
];

/**
 * Send WebSocket command and wait for response
 */
function sendCommand(ws, command) {
  return new Promise((resolve, reject) => {
    const commandId = command.id || `cmd_${Date.now()}_${Math.random()}`;
    command.id = commandId;

    const handler = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.id === commandId || response.command === command.command) {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(response);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    };

    const timeout = setTimeout(() => {
      ws.removeEventListener('message', handler);
      reject(new Error(`Command timeout after ${TIMEOUT}ms: ${command.command}`));
    }, TIMEOUT);

    ws.addEventListener('message', handler);
    ws.send(JSON.stringify(command));
  });
}

/**
 * Validate HTML export response
 */
function validateHtmlExport(result, testSite) {
  const issues = [];
  const checks = {};

  // Check success
  checks.success = result.success === true;
  if (!checks.success) {
    issues.push(`Command failed: ${result.error || 'unknown error'}`);
  }

  // Check HTTP status
  checks.statusCode200 = result.statusCode === 200;
  if (!checks.statusCode200) {
    issues.push(`Expected status 200, got ${result.statusCode}`);
  }

  // Check HTML length
  checks.htmlPresent = result.html && result.html.length > 100;
  if (!checks.htmlPresent) {
    issues.push(`HTML missing or too short (${result.html ? result.html.length : 0} bytes)`);
  }

  // Validate HTML is parseable
  checks.htmlParseable = false;
  try {
    if (result.html) {
      // Check if it's valid HTML structure
      checks.htmlParseable = result.html.includes('<!') || result.html.includes('<html') || result.html.includes('<!DOCTYPE');
    }
  } catch (e) {
    issues.push(`HTML parsing error: ${e.message}`);
  }

  // Check for response headers
  checks.headersPresent = result.responseHeaders && Object.keys(result.responseHeaders).length > 0;
  if (!checks.headersPresent) {
    issues.push('Response headers missing');
  }

  // Check content type
  checks.contentType = result.contentType && result.contentType.includes('text/html');
  if (!checks.contentType) {
    issues.push(`Invalid content type: ${result.contentType}`);
  }

  // Check for expected content indicators
  checks.contentRelevant = false;
  if (result.html) {
    const htmlLower = result.html.toLowerCase();
    const matchedIndicators = testSite.expectedContentIndicators.filter(
      indicator => htmlLower.includes(indicator.toLowerCase())
    );
    checks.contentRelevant = matchedIndicators.length >= Math.ceil(testSite.expectedContentIndicators.length / 2);
    if (!checks.contentRelevant) {
      issues.push(`Content not relevant - matched ${matchedIndicators.length}/${testSite.expectedContentIndicators.length} indicators`);
    }
  }

  return {
    checks,
    issues,
    isValid: Object.values(checks).every(v => v === true)
  };
}

/**
 * Validate network log export response
 */
function validateNetworkLog(result) {
  const issues = [];
  const checks = {};

  // Check success
  checks.success = result.success === true;
  if (!checks.success) {
    issues.push(`Command failed: ${result.error || 'unknown error'}`);
  }

  // Check request count
  checks.requestCount = result.totalRequests >= 10;
  if (!checks.requestCount) {
    issues.push(`Expected 10+ requests, got ${result.totalRequests}`);
  }

  // Check requests array
  checks.requestsArray = Array.isArray(result.requests) && result.requests.length > 0;
  if (!checks.requestsArray) {
    issues.push('No requests in response');
  }

  // Validate request structure
  checks.validRequests = false;
  if (checks.requestsArray && result.requests.length > 0) {
    const sampleRequests = result.requests.slice(0, 5);
    const validRequests = sampleRequests.every(req =>
      req.url && typeof req.url === 'string' &&
      req.method && typeof req.method === 'string' &&
      typeof req.statusCode === 'number' &&
      typeof req.duration === 'number'
    );
    checks.validRequests = validRequests;
    if (!validRequests) {
      issues.push('Request structure invalid - missing required fields (url, method, statusCode, duration)');
    }
  }

  // Check statistics
  checks.statistics = result.statistics && typeof result.statistics === 'object';
  if (!checks.statistics) {
    issues.push('Statistics object missing');
  }

  // Validate statistics accuracy
  checks.statisticsAccurate = false;
  if (checks.statistics) {
    checks.statisticsAccurate =
      typeof result.statistics.totalSize === 'number' &&
      typeof result.statistics.totalDuration === 'number' &&
      typeof result.statistics.byResourceType === 'object' &&
      typeof result.statistics.byStatusCode === 'object';
    if (!checks.statisticsAccurate) {
      issues.push('Statistics structure invalid');
    }
  }

  // Check resource types
  checks.resourceTypes = false;
  if (checks.statistics && result.statistics.byResourceType) {
    const types = Object.keys(result.statistics.byResourceType);
    checks.resourceTypes = types.length > 0;
    if (!checks.resourceTypes) {
      issues.push('No resource types captured');
    }
  }

  // Check status codes captured
  checks.statusCodes = false;
  if (checks.statistics && result.statistics.byStatusCode) {
    const codes = Object.keys(result.statistics.byStatusCode);
    checks.statusCodes = codes.length > 0 && codes.some(code => code.startsWith('2'));
    if (!checks.statusCodes) {
      issues.push('No successful status codes (2xx) captured');
    }
  }

  return {
    checks,
    issues,
    isValid: Object.values(checks).every(v => v === true)
  };
}

/**
 * Validate device IDs export response
 */
function validateDeviceIds(result) {
  const issues = [];
  const checks = {};

  // Check success
  checks.success = result.success === true;
  if (!checks.success) {
    issues.push(`Command failed: ${result.error || 'unknown error'}`);
  }

  // Check device identifiers
  checks.deviceIds = result.deviceIdentifiers && typeof result.deviceIdentifiers === 'object';
  if (!checks.deviceIds) {
    issues.push('Device identifiers missing');
  }

  // Check user agent
  checks.userAgent = false;
  if (checks.deviceIds) {
    checks.userAgent = result.deviceIdentifiers.userAgent && result.deviceIdentifiers.userAgent.length > 10;
    if (!checks.userAgent) {
      issues.push(`Invalid user agent: ${result.deviceIdentifiers.userAgent}`);
    }
  }

  // Check if user agent looks realistic
  checks.userAgentRealistic = false;
  if (checks.userAgent) {
    const ua = result.deviceIdentifiers.userAgent;
    checks.userAgentRealistic =
      (ua.includes('Mozilla') || ua.includes('Chrome') || ua.includes('Safari') || ua.includes('Firefox')) &&
      ua.length > 20;
    if (!checks.userAgentRealistic) {
      issues.push('User agent does not look realistic');
    }
  }

  // Check fingerprint data
  checks.fingerprintData = result.fingerprint && typeof result.fingerprint === 'object';
  if (!checks.fingerprintData) {
    issues.push('Fingerprint data missing');
  }

  // Check canvas fingerprint
  checks.canvasHash = false;
  if (checks.fingerprintData && result.fingerprint.canvas) {
    checks.canvasHash = result.fingerprint.canvas.hash && result.fingerprint.canvas.hash.length > 0;
    if (!checks.canvasHash) {
      issues.push('Canvas fingerprint hash missing or empty');
    }
  }

  // Check WebGL data
  checks.webglData = result.fingerprint && result.fingerprint.webgl;
  if (checks.webglData) {
    const hasHash = result.fingerprint.webgl.hash && result.fingerprint.webgl.hash.length > 0;
    const hasRenderer = result.fingerprint.webgl.renderer && result.fingerprint.webgl.renderer.length > 0;
    checks.webglData = hasHash || hasRenderer;
    if (!checks.webglData) {
      issues.push('WebGL data incomplete');
    }
  }

  // Check screen info
  checks.screenInfo = result.deviceIdentifiers.screen &&
    typeof result.deviceIdentifiers.screen.width === 'number' &&
    typeof result.deviceIdentifiers.screen.height === 'number';
  if (!checks.screenInfo) {
    issues.push('Screen info missing or invalid');
  }

  // Check platform
  checks.platform = result.deviceIdentifiers.platform && result.deviceIdentifiers.platform.length > 0;
  if (!checks.platform) {
    issues.push('Platform missing');
  }

  // Check language
  checks.language = result.deviceIdentifiers.language && result.deviceIdentifiers.language.length > 0;
  if (!checks.language) {
    issues.push('Language missing');
  }

  return {
    checks,
    issues,
    isValid: Object.values(checks).every(v => v === true)
  };
}

/**
 * Validate modify element response
 */
function validateModifyElement(result) {
  const issues = [];
  const checks = {};

  // Check success
  checks.success = result.success === true;
  if (!checks.success) {
    issues.push(`Command failed: ${result.error || 'unknown error'}`);
  }

  // Check matched count
  checks.matched = typeof result.matched === 'number' && result.matched >= 0;
  if (!checks.matched) {
    issues.push(`Invalid matched count: ${result.matched}`);
  }

  // Check modified count
  checks.modified = typeof result.modified === 'number' && result.modified >= 0;
  if (!checks.modified) {
    issues.push(`Invalid modified count: ${result.modified}`);
  }

  // If selector was valid, should have matched something
  checks.elementFound = result.matched > 0;
  if (!checks.elementFound && !result.error) {
    issues.push('No elements matched selector');
  }

  return {
    checks,
    issues,
    isValid: Object.values(checks).every(v => v === true)
  };
}

/**
 * Run all tests
 */
async function runTests() {
  const results = {
    timestamp: new Date().toISOString(),
    sites: [],
    summary: {
      totalSites: TEST_SITES.length,
      successfulSites: 0,
      failedSites: 0,
      exportRawHtml: { passed: 0, failed: 0 },
      exportNetworkLog: { passed: 0, failed: 0 },
      exportDeviceIds: { passed: 0, failed: 0 },
      modifyElement: { passed: 0, failed: 0 }
    }
  };

  for (const site of TEST_SITES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${site.name}`);
    console.log(`URL: ${site.url}`);
    console.log(`${'='.repeat(60)}`);

    const siteResult = {
      name: site.name,
      url: site.url,
      tests: {
        exportRawHtml: null,
        exportNetworkLog: null,
        exportDeviceIds: null,
        modifyElement: null
      },
      rawData: {
        html: null,
        networkLog: null,
        deviceIds: null
      }
    };

    let ws = null;

    try {
      // Connect WebSocket
      ws = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      });

      console.log('Connected to Basset Hound Browser');

      // Test 1: Navigate to site
      console.log(`\n1. Navigating to ${site.name}...`);
      try {
        const navResult = await sendCommand(ws, {
          command: 'navigate',
          url: site.url
        });
        console.log(`   Status: ${navResult.success ? 'OK' : 'FAILED'}`);
        if (!navResult.success) {
          console.log(`   Error: ${navResult.error}`);
        }
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test 2: export_raw_html
      console.log(`\n2. Testing export_raw_html...`);
      try {
        const htmlResult = await sendCommand(ws, {
          command: 'export_raw_html'
        });

        const validation = validateHtmlExport(htmlResult, site);
        siteResult.tests.exportRawHtml = validation;
        siteResult.rawData.html = htmlResult;

        if (validation.isValid) {
          results.summary.exportRawHtml.passed++;
          console.log('   ✓ PASSED');
          console.log(`     - Status: ${htmlResult.statusCode}`);
          console.log(`     - Size: ${(htmlResult.htmlLength / 1024).toFixed(2)} KB`);
          console.log(`     - Content-Type: ${htmlResult.contentType}`);
          console.log(`     - Headers: ${Object.keys(htmlResult.responseHeaders).length} captured`);
        } else {
          results.summary.exportRawHtml.failed++;
          console.log('   ✗ FAILED');
          validation.issues.forEach(issue => console.log(`     - ${issue}`));
        }
      } catch (error) {
        results.summary.exportRawHtml.failed++;
        console.log(`   ✗ FAILED: ${error.message}`);
        siteResult.tests.exportRawHtml = { error: error.message };
      }

      // Test 3: export_network_log
      console.log(`\n3. Testing export_network_log...`);
      try {
        const networkResult = await sendCommand(ws, {
          command: 'export_network_log',
          format: 'json'
        });

        const validation = validateNetworkLog(networkResult);
        siteResult.tests.exportNetworkLog = validation;
        siteResult.rawData.networkLog = networkResult;

        if (validation.isValid) {
          results.summary.exportNetworkLog.passed++;
          console.log('   ✓ PASSED');
          console.log(`     - Requests: ${networkResult.totalRequests}`);
          console.log(`     - Total Size: ${(networkResult.statistics.totalSize / 1024).toFixed(2)} KB`);
          console.log(`     - Duration: ${networkResult.statistics.totalDuration} ms`);

          // Show resource types
          const resourceTypes = Object.entries(networkResult.statistics.byResourceType);
          console.log(`     - Resource Types: ${resourceTypes.map(([type, data]) => `${type}(${data.count})`).join(', ')}`);

          // Show status codes
          const statusCodes = Object.entries(networkResult.statistics.byStatusCode);
          console.log(`     - Status Codes: ${statusCodes.map(([code, count]) => `${code}(${count})`).join(', ')}`);
        } else {
          results.summary.exportNetworkLog.failed++;
          console.log('   ✗ FAILED');
          validation.issues.forEach(issue => console.log(`     - ${issue}`));
        }
      } catch (error) {
        results.summary.exportNetworkLog.failed++;
        console.log(`   ✗ FAILED: ${error.message}`);
        siteResult.tests.exportNetworkLog = { error: error.message };
      }

      // Test 4: export_device_ids
      console.log(`\n4. Testing export_device_ids...`);
      try {
        const deviceResult = await sendCommand(ws, {
          command: 'export_device_ids'
        });

        const validation = validateDeviceIds(deviceResult);
        siteResult.tests.exportDeviceIds = validation;
        siteResult.rawData.deviceIds = deviceResult;

        if (validation.isValid) {
          results.summary.exportDeviceIds.passed++;
          console.log('   ✓ PASSED');
          console.log(`     - User Agent: ${deviceResult.deviceIdentifiers.userAgent.substring(0, 60)}...`);
          console.log(`     - Platform: ${deviceResult.deviceIdentifiers.platform}`);
          console.log(`     - Screen: ${deviceResult.deviceIdentifiers.screen.width}x${deviceResult.deviceIdentifiers.screen.height}`);
          if (deviceResult.fingerprint.canvas) {
            console.log(`     - Canvas Hash: ${deviceResult.fingerprint.canvas.hash.substring(0, 32)}...`);
          }
          if (deviceResult.fingerprint.webgl) {
            console.log(`     - WebGL Hash: ${deviceResult.fingerprint.webgl.hash.substring(0, 32)}...`);
          }
        } else {
          results.summary.exportDeviceIds.failed++;
          console.log('   ✗ FAILED');
          validation.issues.forEach(issue => console.log(`     - ${issue}`));
        }
      } catch (error) {
        results.summary.exportDeviceIds.failed++;
        console.log(`   ✗ FAILED: ${error.message}`);
        siteResult.tests.exportDeviceIds = { error: error.message };
      }

      // Test 5: modify_element
      console.log(`\n5. Testing modify_element...`);
      try {
        const modifyResult = await sendCommand(ws, {
          command: 'modify_element',
          selector: 'title',
          type: 'text',
          value: 'Forensic Test - Modified'
        });

        const validation = validateModifyElement(modifyResult);
        siteResult.tests.modifyElement = validation;

        if (validation.isValid) {
          results.summary.modifyElement.passed++;
          console.log('   ✓ PASSED');
          console.log(`     - Matched: ${modifyResult.matched}`);
          console.log(`     - Modified: ${modifyResult.modified}`);
        } else {
          results.summary.modifyElement.failed++;
          console.log('   ✗ FAILED');
          validation.issues.forEach(issue => console.log(`     - ${issue}`));
        }
      } catch (error) {
        results.summary.modifyElement.failed++;
        console.log(`   ✗ FAILED: ${error.message}`);
        siteResult.tests.modifyElement = { error: error.message };
      }

      // Count site success
      const passedTests = [
        siteResult.tests.exportRawHtml?.isValid,
        siteResult.tests.exportNetworkLog?.isValid,
        siteResult.tests.exportDeviceIds?.isValid,
        siteResult.tests.modifyElement?.isValid
      ].filter(v => v === true).length;

      if (passedTests === 4) {
        results.summary.successfulSites++;
      } else {
        results.summary.failedSites++;
      }

      console.log(`\n${site.name} Results: ${passedTests}/4 tests passed`);

    } catch (error) {
      console.error(`Fatal error testing ${site.name}:`, error.message);
      results.summary.failedSites++;
      siteResult.error = error.message;
    } finally {
      if (ws) {
        ws.close();
      }
    }

    results.sites.push(siteResult);
  }

  // Write results
  const resultsFile = path.join(RESULTS_DIR, 'forensic-validation-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n\nResults saved to: ${resultsFile}`);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('FORENSIC EXPORT VALIDATION SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`\nSites Tested: ${results.summary.successfulSites}/${results.summary.totalSites} successful`);
  console.log(`\nCommand Results:`);
  console.log(`  export_raw_html:    ${results.summary.exportRawHtml.passed}/${results.summary.totalSites} passed`);
  console.log(`  export_network_log: ${results.summary.exportNetworkLog.passed}/${results.summary.totalSites} passed`);
  console.log(`  export_device_ids:  ${results.summary.exportDeviceIds.passed}/${results.summary.totalSites} passed`);
  console.log(`  modify_element:     ${results.summary.modifyElement.passed}/${results.summary.totalSites} passed`);

  // Calculate coverage
  const totalTests = results.summary.totalSites * 4;
  const passedTests =
    results.summary.exportRawHtml.passed +
    results.summary.exportNetworkLog.passed +
    results.summary.exportDeviceIds.passed +
    results.summary.modifyElement.passed;
  const coverage = Math.round((passedTests / totalTests) * 100);
  console.log(`\nOverall Coverage: ${coverage}% (${passedTests}/${totalTests} tests passed)`);
  console.log(`${'='.repeat(60)}\n`);

  return results.summary.successfulSites === results.summary.totalSites && coverage === 100;
}

// Jest test wrapper
describe('Forensic Export Commands - Real Website Validation', () => {
  test('validates forensic commands against real websites', async () => {
    const results = await runTests();
    expect(results.summary.successfulSites).toBe(results.summary.totalSites);
  }, 180000); // 3 minute timeout for all tests
});

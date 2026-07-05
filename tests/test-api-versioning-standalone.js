#!/usr/bin/env node

/**
 * Standalone API Versioning Test Suite
 * Tests the DiagnosticsAPI with version negotiation
 * Can be run independently: node test-api-versioning-standalone.js
 */

const http = require('http');
const { DiagnosticsAPI } = require('../websocket/diagnostics-api');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passCount = 0;
let failCount = 0;
let testCount = 0;

/**
 * Test helper function
 */
async function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8765,
      path,
      method,
      headers,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Assert test result
 */
function assert(name, condition, details = '') {
  testCount++;
  if (condition) {
    console.log(`${colors.green}✓ PASS${colors.reset} - ${name}`);
    passCount++;
  } else {
    console.log(`${colors.red}✗ FAIL${colors.reset} - ${name}`);
    if (details) {
      console.log(`  ${details}`);
    }
    failCount++;
  }
}

/**
 * Test suite
 */
async function runTests() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}API Versioning Test Suite${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  try {
    // Test 1: Version endpoint
    console.log(`${colors.yellow}[1] Version Negotiation Endpoint${colors.reset}`);
    let res = await makeRequest('GET', '/api/version');
    assert('Version endpoint returns 200', res.statusCode === 200);
    const versionData = JSON.parse(res.body);
    assert('Version endpoint has supportedVersions', versionData.apiVersions && versionData.apiVersions.length > 0);
    assert('Version endpoint has v1 and v2',
      versionData.apiVersions.some(v => v.version === '1.0') &&
      versionData.apiVersions.some(v => v.version === '2.0'));
    console.log();

    // Test 2: V1 help endpoint via URL
    console.log(`${colors.yellow}[2] V1 Help Endpoint (URL Prefix)${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/help');
    assert('V1 help returns 200', res.statusCode === 200);
    const helpV1 = JSON.parse(res.body);
    assert('V1 help has apiVersion field', helpV1.apiVersion === '1.0');
    assert('V1 help has commands', helpV1.commands && typeof helpV1.commands === 'object');
    console.log();

    // Test 3: V2 help endpoint via URL
    console.log(`${colors.yellow}[3] V2 Help Endpoint (URL Prefix)${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/help');
    assert('V2 help returns 200', res.statusCode === 200);
    const helpV2 = JSON.parse(res.body);
    assert('V2 help has apiVersion field', helpV2.apiVersion === '2.0');
    assert('V2 help has versionInfo', helpV2.versionInfo && helpV2.versionInfo.version === '2.0');
    assert('V2 help has deprecations', Array.isArray(helpV2.deprecations));
    console.log();

    // Test 4: Legacy endpoint defaults to v1
    console.log(`${colors.yellow}[4] Legacy Endpoint (Defaults to V1)${colors.reset}`);
    res = await makeRequest('GET', '/api/help');
    assert('Legacy help returns 200', res.statusCode === 200);
    const legacyHelp = JSON.parse(res.body);
    assert('Legacy help defaults to v1', legacyHelp.apiVersion === '1.0');
    console.log();

    // Test 5: V1 diagnostics
    console.log(`${colors.yellow}[5] V1 Diagnostics Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/diagnostics');
    assert('V1 diagnostics returns 200', res.statusCode === 200);
    const diagV1 = JSON.parse(res.body);
    assert('V1 diagnostics has apiVersion', diagV1.apiVersion === '1.0');
    assert('V1 diagnostics has version', diagV1.version);
    assert('V1 diagnostics has features', diagV1.features);
    assert('V1 diagnostics does NOT have telemetry', !diagV1.telemetry);
    console.log();

    // Test 6: V2 diagnostics
    console.log(`${colors.yellow}[6] V2 Diagnostics Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/diagnostics');
    assert('V2 diagnostics returns 200', res.statusCode === 200);
    const diagV2 = JSON.parse(res.body);
    assert('V2 diagnostics has apiVersion', diagV2.apiVersion === '2.0');
    assert('V2 diagnostics has telemetry', diagV2.telemetry);
    assert('V2 diagnostics has recommendations', Array.isArray(diagV2.recommendations));
    assert('V2 diagnostics has versionInfo', diagV2.versionInfo);
    console.log();

    // Test 7: V1 status
    console.log(`${colors.yellow}[7] V1 Status Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/status');
    assert('V1 status returns 200', res.statusCode === 200);
    const statusV1 = JSON.parse(res.body);
    assert('V1 status has apiVersion', statusV1.apiVersion === '1.0');
    assert('V1 status does NOT have recommendations', !statusV1.recommendations);
    console.log();

    // Test 8: V2 status
    console.log(`${colors.yellow}[8] V2 Status Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/status');
    assert('V2 status returns 200', res.statusCode === 200);
    const statusV2 = JSON.parse(res.body);
    assert('V2 status has apiVersion', statusV2.apiVersion === '2.0');
    assert('V2 status has recommendations', statusV2.recommendations);
    console.log();

    // Test 9: V1 schema
    console.log(`${colors.yellow}[9] V1 Schema Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/schema');
    assert('V1 schema returns 200', res.statusCode === 200);
    const schemaV1 = JSON.parse(res.body);
    assert('V1 schema is OpenAPI 3.0.0', schemaV1.openapi === '3.0.0');
    assert('V1 schema has x-api-version', schemaV1.info['x-api-version'] === '1.0');
    assert('V1 schema does NOT have x-version-info', !schemaV1['x-version-info']);
    console.log();

    // Test 10: V2 schema
    console.log(`${colors.yellow}[10] V2 Schema Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/schema');
    assert('V2 schema returns 200', res.statusCode === 200);
    const schemaV2 = JSON.parse(res.body);
    assert('V2 schema is OpenAPI 3.0.0', schemaV2.openapi === '3.0.0');
    assert('V2 schema has x-api-version', schemaV2.info['x-api-version'] === '2.0');
    assert('V2 schema has x-version-info', schemaV2['x-version-info']);
    assert('V2 schema has deprecated commands', Array.isArray(schemaV2['x-deprecated-commands']));
    console.log();

    // Test 11: Accept-Version header negotiation
    console.log(`${colors.yellow}[11] Version Negotiation (Accept-Version Header)${colors.reset}`);
    res = await makeRequest('GET', '/api/help', { 'Accept-Version': '2.0' });
    assert('Accept-Version header works', res.statusCode === 200);
    const negotiatedHelp = JSON.parse(res.body);
    assert('Accept-Version header selects v2', negotiatedHelp.apiVersion === '2.0');
    assert('Accept-Version header adds v2 features', negotiatedHelp.versionInfo);
    console.log();

    // Test 12: Query parameter version negotiation
    console.log(`${colors.yellow}[12] Version Negotiation (Query Parameter)${colors.reset}`);
    res = await makeRequest('GET', '/api/help?apiVersion=2');
    assert('Query param apiVersion works', res.statusCode === 200);
    const queryHelp = JSON.parse(res.body);
    assert('Query param selects v2', queryHelp.apiVersion === '2.0');
    console.log();

    // Test 13: Response headers include version info
    console.log(`${colors.yellow}[13] Response Headers Include Version${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/status');
    assert('Response has X-API-Version header', res.headers['x-api-version'] === '2.0');
    assert('Response has X-Response-Time-Ms header', res.headers['x-response-time-ms']);
    console.log();

    // Test 14: Help with command parameter in v1
    console.log(`${colors.yellow}[14] V1 Help with Command Parameter${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/help?command=navigate');
    assert('V1 help command param returns 200 or 404',
      res.statusCode === 200 || res.statusCode === 404);
    console.log();

    // Test 15: Help with command parameter in v2
    console.log(`${colors.yellow}[15] V2 Help with Command Parameter${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/help?command=navigate');
    assert('V2 help command param returns 200 or 404',
      res.statusCode === 200 || res.statusCode === 404);
    if (res.statusCode === 200) {
      const cmdHelp = JSON.parse(res.body);
      assert('V2 command help includes apiVersion', cmdHelp.apiVersion === '2.0');
    }
    console.log();

    // Test 16: Invalid endpoint returns 404
    console.log(`${colors.yellow}[16] Invalid Endpoint${colors.reset}`);
    res = await makeRequest('GET', '/api/invalid');
    assert('Invalid endpoint returns 404', res.statusCode === 404);
    assert('404 response is valid JSON', () => {
      try { JSON.parse(res.body); return true; } catch { return false; }
    }());
    console.log();

    // Test 17: Help search in v1
    console.log(`${colors.yellow}[17] V1 Help Search${colors.reset}`);
    res = await makeRequest('GET', '/api/v1/help?search=navigate');
    assert('V1 help search returns 200', res.statusCode === 200);
    const searchV1 = JSON.parse(res.body);
    assert('V1 search has apiVersion', searchV1.apiVersion === '1.0');
    console.log();

    // Test 18: Help search in v2
    console.log(`${colors.yellow}[18] V2 Help Search${colors.reset}`);
    res = await makeRequest('GET', '/api/v2/help?search=navigate');
    assert('V2 help search returns 200', res.statusCode === 200);
    const searchV2 = JSON.parse(res.body);
    assert('V2 search has apiVersion', searchV2.apiVersion === '2.0');
    assert('V2 search includes deprecation info', searchV2.deprecations !== undefined);
    console.log();

  } catch (error) {
    console.error(`${colors.red}Test error: ${error.message}${colors.reset}`);
    failCount++;
  }

  // Print summary
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`Total Tests:  ${testCount}`);
  console.log(`${colors.green}Passed:       ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed:       ${failCount}${colors.reset}`);
  console.log();

  if (failCount === 0) {
    console.log(`${colors.green}✓ All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some tests failed${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests if server is available
console.log(`${colors.cyan}Waiting for server on localhost:8765...${colors.reset}`);

// Try to connect with retries
const maxRetries = 10;
let retries = 0;

const tryConnect = async () => {
  try {
    await makeRequest('GET', '/api/version');
    console.log(`${colors.green}✓ Connected to server${colors.reset}\n`);
    await runTests();
  } catch (error) {
    retries++;
    if (retries < maxRetries) {
      console.log(`Retry ${retries}/${maxRetries}... (${error.message})`);
      setTimeout(tryConnect, 500);
    } else {
      console.error(`${colors.red}Could not connect to server after ${maxRetries} attempts${colors.reset}`);
      console.error('Make sure the diagnostics API server is running on localhost:8765');
      process.exit(1);
    }
  }
};

tryConnect();

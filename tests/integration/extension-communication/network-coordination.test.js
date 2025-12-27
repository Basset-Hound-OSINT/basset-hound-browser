/**
 * Network Request Coordination Integration Tests
 *
 * Tests network request coordination between the Chrome extension and Electron browser.
 * Verifies request interception, blocking, and monitoring synchronization.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8774;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Network state
const networkState = {
  capturing: false,
  requestLog: [],
  blockRules: [],
  interceptRules: [],
  redirectRules: [],
  headerRules: []
};

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    // Reset network state
    networkState.capturing = false;
    networkState.requestLog = [];
    networkState.blockRules = [];
    networkState.interceptRules = [];
    networkState.redirectRules = [];
    networkState.headerRules = [];

    server = new TestServer({ port: TEST_PORT });
    setupServerHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL, autoReconnect: false });
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
  },

  // Simulate a network request for testing
  simulateRequest(details) {
    if (!networkState.capturing) return;

    const request = {
      id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      url: details.url,
      method: details.method || 'GET',
      type: details.type || 'xhr',
      headers: details.headers || {},
      timestamp: Date.now(),
      status: 'pending'
    };

    // Check block rules
    for (const rule of networkState.blockRules) {
      if (new RegExp(rule.pattern).test(request.url)) {
        request.blocked = true;
        request.blockedBy = rule.id;
        break;
      }
    }

    // Check redirect rules
    if (!request.blocked) {
      for (const rule of networkState.redirectRules) {
        if (new RegExp(rule.pattern).test(request.url)) {
          request.redirected = true;
          request.redirectUrl = request.url.replace(new RegExp(rule.pattern), rule.destination);
          request.redirectedBy = rule.id;
          break;
        }
      }
    }

    // Apply header rules
    for (const rule of networkState.headerRules) {
      if (new RegExp(rule.pattern).test(request.url)) {
        request.headers = { ...request.headers, ...rule.headers };
        request.headersModifiedBy = rule.id;
      }
    }

    networkState.requestLog.push(request);
    return request;
  }
};

/**
 * Setup server handlers for network coordination
 */
function setupServerHandlers() {
  // Network capture control
  server.registerHandler('start_network_capture', async (params) => {
    networkState.capturing = true;
    return {
      success: true,
      capturing: true,
      urlPatterns: params.urlPatterns || ['<all_urls>'],
      types: params.types || ['all']
    };
  });

  server.registerHandler('stop_network_capture', async (params) => {
    networkState.capturing = false;
    const includeLog = params.includeLog !== false;
    return {
      success: true,
      capturing: false,
      log: includeLog ? networkState.requestLog : undefined,
      count: networkState.requestLog.length
    };
  });

  server.registerHandler('get_network_log', async (params) => {
    let log = [...networkState.requestLog];

    // Apply filters
    if (params.urlPattern) {
      const regex = new RegExp(params.urlPattern);
      log = log.filter(r => regex.test(r.url));
    }
    if (params.method) {
      log = log.filter(r => r.method === params.method);
    }
    if (params.type) {
      log = log.filter(r => r.type === params.type);
    }
    if (params.blocked !== undefined) {
      log = log.filter(r => !!r.blocked === params.blocked);
    }
    if (params.limit) {
      log = log.slice(-params.limit);
    }

    return {
      success: true,
      log,
      count: log.length,
      totalCount: networkState.requestLog.length,
      capturing: networkState.capturing
    };
  });

  server.registerHandler('clear_network_log', async (params) => {
    const count = networkState.requestLog.length;
    networkState.requestLog = [];
    return { success: true, cleared: count };
  });

  // Block rules
  server.registerHandler('add_block_rule', async (params) => {
    const rule = {
      id: params.id || `block-${Date.now()}`,
      pattern: params.pattern,
      type: 'block',
      createdAt: new Date().toISOString()
    };
    networkState.blockRules.push(rule);
    return { success: true, rule };
  });

  server.registerHandler('remove_block_rule', async (params) => {
    const index = networkState.blockRules.findIndex(r => r.id === params.id);
    if (index === -1) {
      return { success: false, error: 'Rule not found' };
    }
    networkState.blockRules.splice(index, 1);
    return { success: true };
  });

  server.registerHandler('get_block_rules', async () => {
    return { success: true, rules: networkState.blockRules };
  });

  server.registerHandler('clear_block_rules', async () => {
    const count = networkState.blockRules.length;
    networkState.blockRules = [];
    return { success: true, cleared: count };
  });

  // Redirect rules
  server.registerHandler('add_redirect_rule', async (params) => {
    const rule = {
      id: params.id || `redirect-${Date.now()}`,
      pattern: params.pattern,
      destination: params.destination,
      type: 'redirect',
      createdAt: new Date().toISOString()
    };
    networkState.redirectRules.push(rule);
    return { success: true, rule };
  });

  server.registerHandler('remove_redirect_rule', async (params) => {
    const index = networkState.redirectRules.findIndex(r => r.id === params.id);
    if (index === -1) {
      return { success: false, error: 'Rule not found' };
    }
    networkState.redirectRules.splice(index, 1);
    return { success: true };
  });

  server.registerHandler('get_redirect_rules', async () => {
    return { success: true, rules: networkState.redirectRules };
  });

  // Header modification rules
  server.registerHandler('add_header_rule', async (params) => {
    const rule = {
      id: params.id || `header-${Date.now()}`,
      pattern: params.pattern,
      headers: params.headers,
      type: 'header',
      createdAt: new Date().toISOString()
    };
    networkState.headerRules.push(rule);
    return { success: true, rule };
  });

  server.registerHandler('remove_header_rule', async (params) => {
    const index = networkState.headerRules.findIndex(r => r.id === params.id);
    if (index === -1) {
      return { success: false, error: 'Rule not found' };
    }
    networkState.headerRules.splice(index, 1);
    return { success: true };
  });

  server.registerHandler('get_header_rules', async () => {
    return { success: true, rules: networkState.headerRules };
  });

  // Get all rules
  server.registerHandler('get_all_rules', async () => {
    return {
      success: true,
      rules: {
        block: networkState.blockRules,
        redirect: networkState.redirectRules,
        header: networkState.headerRules
      },
      totalCount: networkState.blockRules.length +
                  networkState.redirectRules.length +
                  networkState.headerRules.length
    };
  });

  // Clear all rules
  server.registerHandler('clear_all_rules', async () => {
    const counts = {
      block: networkState.blockRules.length,
      redirect: networkState.redirectRules.length,
      header: networkState.headerRules.length
    };
    networkState.blockRules = [];
    networkState.redirectRules = [];
    networkState.headerRules = [];
    return { success: true, cleared: counts };
  });

  // Simulate request (for testing)
  server.registerHandler('simulate_request', async (params) => {
    const request = testUtils.simulateRequest(params);
    return { success: true, request };
  });

  // Get network stats
  server.registerHandler('get_network_stats', async () => {
    const log = networkState.requestLog;
    return {
      success: true,
      stats: {
        totalRequests: log.length,
        blocked: log.filter(r => r.blocked).length,
        redirected: log.filter(r => r.redirected).length,
        byMethod: {
          GET: log.filter(r => r.method === 'GET').length,
          POST: log.filter(r => r.method === 'POST').length,
          PUT: log.filter(r => r.method === 'PUT').length,
          DELETE: log.filter(r => r.method === 'DELETE').length
        },
        byType: {
          xhr: log.filter(r => r.type === 'xhr').length,
          fetch: log.filter(r => r.type === 'fetch').length,
          script: log.filter(r => r.type === 'script').length,
          image: log.filter(r => r.type === 'image').length
        }
      },
      capturing: networkState.capturing,
      ruleCount: {
        block: networkState.blockRules.length,
        redirect: networkState.redirectRules.length,
        header: networkState.headerRules.length
      }
    };
  });
}

/**
 * Test Suite: Network Capture Start/Stop
 */
async function testNetworkCaptureStartStop() {
  console.log('\n--- Test: Network Capture Start/Stop ---');

  // Start capture from extension
  const startResponse = await extension.sendCommand('start_network_capture', {
    urlPatterns: ['*://api.example.com/*']
  });

  assert(startResponse.success, 'Start capture should succeed');
  assert(startResponse.result.capturing, 'Should be capturing');
  console.log('  Network capture started');

  // Verify capture state
  const statsResponse = await extension.sendCommand('get_network_stats', {});
  assert(statsResponse.result.capturing, 'Stats should show capturing');
  console.log('  Capture state verified');

  // Stop capture
  const stopResponse = await extension.sendCommand('stop_network_capture', {});

  assert(stopResponse.success, 'Stop capture should succeed');
  assert(!stopResponse.result.capturing, 'Should not be capturing');
  console.log('  Network capture stopped');

  console.log('PASSED: Network Capture Start/Stop');
  return true;
}

/**
 * Test Suite: Request Logging
 */
async function testRequestLogging() {
  console.log('\n--- Test: Request Logging ---');

  // Start capture
  await extension.sendCommand('start_network_capture', {});

  // Simulate some requests
  await extension.sendCommand('simulate_request', {
    url: 'https://api.example.com/users',
    method: 'GET',
    type: 'xhr'
  });

  await extension.sendCommand('simulate_request', {
    url: 'https://api.example.com/data',
    method: 'POST',
    type: 'fetch'
  });

  await extension.sendCommand('simulate_request', {
    url: 'https://cdn.example.com/script.js',
    method: 'GET',
    type: 'script'
  });
  console.log('  Simulated 3 requests');

  // Get log
  const logResponse = await extension.sendCommand('get_network_log', {});

  assert(logResponse.success, 'Get log should succeed');
  assert(logResponse.result.log.length === 3, 'Should have 3 requests');
  console.log('  All requests logged');

  // Filter by method
  const getLogResponse = await extension.sendCommand('get_network_log', {
    method: 'GET'
  });

  assert(getLogResponse.result.log.length === 2, 'Should have 2 GET requests');
  console.log('  Filtered by method');

  // Filter by URL pattern
  const apiLogResponse = await extension.sendCommand('get_network_log', {
    urlPattern: 'api\\.example\\.com'
  });

  assert(apiLogResponse.result.log.length === 2, 'Should have 2 API requests');
  console.log('  Filtered by URL pattern');

  // Stop capture
  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Request Logging');
  return true;
}

/**
 * Test Suite: Block Rules Sync
 */
async function testBlockRulesSync() {
  console.log('\n--- Test: Block Rules Sync ---');

  // Clear any existing rules
  await extension.sendCommand('clear_all_rules', {});

  // Extension adds block rule
  const addRuleResponse = await extension.sendCommand('add_block_rule', {
    id: 'block-tracking',
    pattern: '.*tracking\\.com.*'
  });

  assert(addRuleResponse.success, 'Add block rule should succeed');
  console.log('  Extension added block rule');

  // Browser should see the rule
  const browserRulesResponse = await browser.sendCommand('get_block_rules', {});

  assert(browserRulesResponse.result.rules.length === 1, 'Browser should see 1 rule');
  assert(browserRulesResponse.result.rules[0].id === 'block-tracking', 'Rule ID should match');
  console.log('  Browser sees the block rule');

  // Add more rules from browser
  await browser.sendCommand('add_block_rule', {
    id: 'block-ads',
    pattern: '.*ads\\..*'
  });
  console.log('  Browser added block rule');

  // Extension should see all rules
  const extensionRulesResponse = await extension.sendCommand('get_block_rules', {});

  assert(extensionRulesResponse.result.rules.length === 2, 'Extension should see 2 rules');
  console.log('  Extension sees both rules');

  // Test blocking works
  await extension.sendCommand('start_network_capture', {});

  await extension.sendCommand('simulate_request', {
    url: 'https://tracking.com/pixel.gif',
    method: 'GET'
  });

  await extension.sendCommand('simulate_request', {
    url: 'https://example.com/page.html',
    method: 'GET'
  });

  const logResponse = await extension.sendCommand('get_network_log', { blocked: true });

  assert(logResponse.result.log.length === 1, 'Should have 1 blocked request');
  assert(logResponse.result.log[0].blockedBy === 'block-tracking', 'Should be blocked by tracking rule');
  console.log('  Blocking works correctly');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Block Rules Sync');
  return true;
}

/**
 * Test Suite: Redirect Rules Sync
 */
async function testRedirectRulesSync() {
  console.log('\n--- Test: Redirect Rules Sync ---');

  // Clear existing rules
  await extension.sendCommand('clear_all_rules', {});

  // Extension adds redirect rule
  const addRuleResponse = await extension.sendCommand('add_redirect_rule', {
    id: 'redirect-api',
    pattern: 'https://api\\.old\\.com(.*)',
    destination: 'https://api.new.com$1'
  });

  assert(addRuleResponse.success, 'Add redirect rule should succeed');
  console.log('  Extension added redirect rule');

  // Browser should see the rule
  const browserRulesResponse = await browser.sendCommand('get_redirect_rules', {});

  assert(browserRulesResponse.result.rules.length === 1, 'Browser should see 1 rule');
  console.log('  Browser sees the redirect rule');

  // Test redirection works
  await extension.sendCommand('start_network_capture', {});

  await extension.sendCommand('simulate_request', {
    url: 'https://api.old.com/v1/users',
    method: 'GET'
  });

  const logResponse = await extension.sendCommand('get_network_log', {});
  const request = logResponse.result.log[0];

  assert(request.redirected, 'Request should be redirected');
  assert(request.redirectUrl === 'https://api.new.com/v1/users', 'Redirect URL should be correct');
  console.log('  Redirection works correctly');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Redirect Rules Sync');
  return true;
}

/**
 * Test Suite: Header Rules Sync
 */
async function testHeaderRulesSync() {
  console.log('\n--- Test: Header Rules Sync ---');

  // Clear existing rules
  await extension.sendCommand('clear_all_rules', {});

  // Extension adds header rule
  const addRuleResponse = await extension.sendCommand('add_header_rule', {
    id: 'add-auth-header',
    pattern: '.*api\\.example\\.com.*',
    headers: {
      'Authorization': 'Bearer token123',
      'X-Custom-Header': 'custom-value'
    }
  });

  assert(addRuleResponse.success, 'Add header rule should succeed');
  console.log('  Extension added header rule');

  // Browser should see the rule
  const browserRulesResponse = await browser.sendCommand('get_header_rules', {});

  assert(browserRulesResponse.result.rules.length === 1, 'Browser should see 1 rule');
  console.log('  Browser sees the header rule');

  // Test header modification works
  await extension.sendCommand('start_network_capture', {});

  await extension.sendCommand('simulate_request', {
    url: 'https://api.example.com/data',
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  const logResponse = await extension.sendCommand('get_network_log', {});
  const request = logResponse.result.log[0];

  assert(request.headers['Authorization'] === 'Bearer token123', 'Auth header should be added');
  assert(request.headers['X-Custom-Header'] === 'custom-value', 'Custom header should be added');
  assert(request.headers['Accept'] === 'application/json', 'Original header should be preserved');
  console.log('  Header modification works correctly');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Header Rules Sync');
  return true;
}

/**
 * Test Suite: Rule Removal Sync
 */
async function testRuleRemovalSync() {
  console.log('\n--- Test: Rule Removal Sync ---');

  // Clear and add rules
  await extension.sendCommand('clear_all_rules', {});

  await extension.sendCommand('add_block_rule', { id: 'rule-1', pattern: 'pattern1' });
  await extension.sendCommand('add_block_rule', { id: 'rule-2', pattern: 'pattern2' });
  await extension.sendCommand('add_block_rule', { id: 'rule-3', pattern: 'pattern3' });

  let rulesResponse = await extension.sendCommand('get_block_rules', {});
  assert(rulesResponse.result.rules.length === 3, 'Should have 3 rules');
  console.log('  Added 3 rules');

  // Remove rule from browser
  await browser.sendCommand('remove_block_rule', { id: 'rule-2' });
  console.log('  Browser removed rule-2');

  // Extension should see updated rules
  rulesResponse = await extension.sendCommand('get_block_rules', {});
  assert(rulesResponse.result.rules.length === 2, 'Should have 2 rules');
  const ruleIds = rulesResponse.result.rules.map(r => r.id);
  assert(!ruleIds.includes('rule-2'), 'rule-2 should be removed');
  console.log('  Extension sees updated rules');

  console.log('PASSED: Rule Removal Sync');
  return true;
}

/**
 * Test Suite: Clear All Rules Sync
 */
async function testClearAllRulesSync() {
  console.log('\n--- Test: Clear All Rules Sync ---');

  // Add various rules
  await extension.sendCommand('add_block_rule', { pattern: 'block1' });
  await extension.sendCommand('add_redirect_rule', { pattern: 'redir1', destination: 'dest1' });
  await extension.sendCommand('add_header_rule', { pattern: 'header1', headers: { 'X': 'Y' } });

  let allRulesResponse = await extension.sendCommand('get_all_rules', {});
  assert(allRulesResponse.result.totalCount === 3, 'Should have 3 rules total');
  console.log('  Added various rules');

  // Browser clears all rules
  const clearResponse = await browser.sendCommand('clear_all_rules', {});
  assert(clearResponse.success, 'Clear all should succeed');
  console.log('  Browser cleared all rules');

  // Extension should see no rules
  allRulesResponse = await extension.sendCommand('get_all_rules', {});
  assert(allRulesResponse.result.totalCount === 0, 'Should have no rules');
  console.log('  Extension sees no rules');

  console.log('PASSED: Clear All Rules Sync');
  return true;
}

/**
 * Test Suite: Network Stats Sync
 */
async function testNetworkStatsSync() {
  console.log('\n--- Test: Network Stats Sync ---');

  // Clear and set up
  await extension.sendCommand('clear_network_log', {});
  await extension.sendCommand('clear_all_rules', {});
  await extension.sendCommand('add_block_rule', { pattern: '.*blocked.*' });

  // Start capture and simulate requests
  await extension.sendCommand('start_network_capture', {});

  await extension.sendCommand('simulate_request', { url: 'https://api.com/1', method: 'GET', type: 'xhr' });
  await extension.sendCommand('simulate_request', { url: 'https://api.com/2', method: 'POST', type: 'fetch' });
  await extension.sendCommand('simulate_request', { url: 'https://blocked.com/track', method: 'GET', type: 'image' });
  await extension.sendCommand('simulate_request', { url: 'https://api.com/3', method: 'GET', type: 'xhr' });

  console.log('  Simulated 4 requests');

  // Get stats from extension
  const extStatsResponse = await extension.sendCommand('get_network_stats', {});

  assert(extStatsResponse.result.stats.totalRequests === 4, 'Should have 4 total requests');
  assert(extStatsResponse.result.stats.blocked === 1, 'Should have 1 blocked');
  assert(extStatsResponse.result.stats.byMethod.GET === 3, 'Should have 3 GET');
  assert(extStatsResponse.result.stats.byMethod.POST === 1, 'Should have 1 POST');
  console.log('  Extension stats correct');

  // Browser should see same stats
  const browserStatsResponse = await browser.sendCommand('get_network_stats', {});

  assert(browserStatsResponse.result.stats.totalRequests === 4, 'Browser should see 4 total');
  assert(browserStatsResponse.result.stats.blocked === 1, 'Browser should see 1 blocked');
  console.log('  Browser stats match');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Network Stats Sync');
  return true;
}

/**
 * Test Suite: Log Clear Sync
 */
async function testLogClearSync() {
  console.log('\n--- Test: Log Clear Sync ---');

  // Start capture and log some requests
  await extension.sendCommand('start_network_capture', {});
  await extension.sendCommand('simulate_request', { url: 'https://example.com/1' });
  await extension.sendCommand('simulate_request', { url: 'https://example.com/2' });
  await extension.sendCommand('simulate_request', { url: 'https://example.com/3' });

  let logResponse = await extension.sendCommand('get_network_log', {});
  assert(logResponse.result.log.length === 3, 'Should have 3 requests');
  console.log('  Logged 3 requests');

  // Browser clears log
  const clearResponse = await browser.sendCommand('clear_network_log', {});
  assert(clearResponse.success, 'Clear should succeed');
  assert(clearResponse.result.cleared === 3, 'Should clear 3 requests');
  console.log('  Browser cleared log');

  // Extension should see empty log
  logResponse = await extension.sendCommand('get_network_log', {});
  assert(logResponse.result.log.length === 0, 'Log should be empty');
  console.log('  Extension sees empty log');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Log Clear Sync');
  return true;
}

/**
 * Test Suite: Complex Rule Interactions
 */
async function testComplexRuleInteractions() {
  console.log('\n--- Test: Complex Rule Interactions ---');

  // Clear and set up multiple rules
  await extension.sendCommand('clear_all_rules', {});

  // Add block rule for tracking
  await extension.sendCommand('add_block_rule', {
    id: 'block-tracking',
    pattern: '.*tracking.*'
  });

  // Add redirect rule for API migration
  await extension.sendCommand('add_redirect_rule', {
    id: 'api-migration',
    pattern: 'https://v1\\.api\\.com(.*)',
    destination: 'https://v2.api.com$1'
  });

  // Add header rule for auth
  await extension.sendCommand('add_header_rule', {
    id: 'api-auth',
    pattern: '.*api\\.com.*',
    headers: { 'Authorization': 'Bearer xyz' }
  });

  console.log('  Set up complex rules');

  // Start capture
  await extension.sendCommand('start_network_capture', {});

  // Simulate various requests
  // 1. Blocked tracking request
  await extension.sendCommand('simulate_request', {
    url: 'https://tracking.example.com/pixel',
    method: 'GET'
  });

  // 2. Redirected API request with headers
  await extension.sendCommand('simulate_request', {
    url: 'https://v1.api.com/users',
    method: 'GET'
  });

  // 3. Normal request
  await extension.sendCommand('simulate_request', {
    url: 'https://example.com/page',
    method: 'GET'
  });

  const logResponse = await extension.sendCommand('get_network_log', {});
  const log = logResponse.result.log;

  // Verify blocked request
  const blockedRequest = log.find(r => r.url.includes('tracking'));
  assert(blockedRequest.blocked, 'Tracking request should be blocked');
  console.log('  Tracking request blocked');

  // Verify redirected request
  const redirectedRequest = log.find(r => r.url.includes('v1.api'));
  assert(redirectedRequest.redirected, 'API request should be redirected');
  assert(redirectedRequest.redirectUrl.includes('v2.api'), 'Should redirect to v2');
  console.log('  API request redirected');

  // Verify normal request
  const normalRequest = log.find(r => r.url.includes('example.com/page'));
  assert(!normalRequest.blocked, 'Normal request should not be blocked');
  assert(!normalRequest.redirected, 'Normal request should not be redirected');
  console.log('  Normal request unaffected');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Complex Rule Interactions');
  return true;
}

/**
 * Test Suite: Cross-Component Rule Application
 */
async function testCrossComponentRuleApplication() {
  console.log('\n--- Test: Cross-Component Rule Application ---');

  await extension.sendCommand('clear_all_rules', {});
  await extension.sendCommand('clear_network_log', {});

  // Extension adds rules
  await extension.sendCommand('add_block_rule', {
    id: 'ext-block',
    pattern: '.*extension-blocked.*'
  });
  console.log('  Extension added block rule');

  // Browser adds rules
  await browser.sendCommand('add_block_rule', {
    id: 'browser-block',
    pattern: '.*browser-blocked.*'
  });
  console.log('  Browser added block rule');

  // Verify both components see both rules
  const extRulesResponse = await extension.sendCommand('get_block_rules', {});
  assert(extRulesResponse.result.rules.length === 2, 'Extension should see 2 rules');

  const browserRulesResponse = await browser.sendCommand('get_block_rules', {});
  assert(browserRulesResponse.result.rules.length === 2, 'Browser should see 2 rules');
  console.log('  Both components see all rules');

  // Start capture and test both rules work
  await extension.sendCommand('start_network_capture', {});

  await extension.sendCommand('simulate_request', { url: 'https://extension-blocked.com/x' });
  await extension.sendCommand('simulate_request', { url: 'https://browser-blocked.com/y' });
  await extension.sendCommand('simulate_request', { url: 'https://allowed.com/z' });

  const logResponse = await extension.sendCommand('get_network_log', {});
  const blocked = logResponse.result.log.filter(r => r.blocked);

  assert(blocked.length === 2, 'Should have 2 blocked requests');
  console.log('  Both rule sources effective');

  await extension.sendCommand('stop_network_capture', {});

  console.log('PASSED: Cross-Component Rule Application');
  return true;
}

/**
 * Run all network coordination tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Network Request Coordination Integration Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Network Capture Start/Stop', fn: testNetworkCaptureStartStop },
    { name: 'Request Logging', fn: testRequestLogging },
    { name: 'Block Rules Sync', fn: testBlockRulesSync },
    { name: 'Redirect Rules Sync', fn: testRedirectRulesSync },
    { name: 'Header Rules Sync', fn: testHeaderRulesSync },
    { name: 'Rule Removal Sync', fn: testRuleRemovalSync },
    { name: 'Clear All Rules Sync', fn: testClearAllRulesSync },
    { name: 'Network Stats Sync', fn: testNetworkStatsSync },
    { name: 'Log Clear Sync', fn: testLogClearSync },
    { name: 'Complex Rule Interactions', fn: testComplexRuleInteractions },
    { name: 'Cross-Component Rule Application', fn: testCrossComponentRuleApplication }
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
  console.log('Network Coordination Test Summary');
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

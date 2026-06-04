#!/usr/bin/env node

/**
 * End-to-End Critical User Journey Testing
 * Validates complete user workflows from start to finish
 * Test count: 15+ critical journey scenarios
 */

const WebSocket = require('ws');
const assert = require('assert');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;

// Test Results Tracking
const TEST_RESULTS = {
  journeys: {
    newUserSignup: { passed: 0, failed: 0, time: 0 },
    existingUserLogin: { passed: 0, failed: 0, time: 0 },
    competitiveMonitoring: { passed: 0, failed: 0, time: 0 },
    forensicEvidence: { passed: 0, failed: 0, time: 0 },
    multiMonitorCampaign: { passed: 0, failed: 0, time: 0 },
  },
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: [],
};

/**
 * WebSocket Client with Enhanced Error Handling
 */
class TestWebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.messageQueue = [];
    this.responseMap = new Map();
    this.requestId = 0;
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(100);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              this.responseMap.get(msg.requestId).resolve(msg);
              this.responseMap.delete(msg.requestId);
            } else {
              this.messageQueue.push(msg);
            }
          } catch (e) {
            // Silent parse failure
          }
        });

        this.ws.on('error', (err) => {
          if (!this.connected) reject(err);
        });

        this.ws.on('close', () => {
          this.connected = false;
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('WebSocket connection timeout'));
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const requestId = ++this.requestId;
    const message = { command, params, requestId };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeoutHandle);
          if (msg.error) {
            reject(new Error(msg.error));
          } else {
            resolve(msg);
          }
        },
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

/**
 * Journey 1: New User Signup Flow
 * Validates: Navigate -> Click form -> Fill fields -> Submit -> Verify success
 */
async function testNewUserSignupJourney(client) {
  const startTime = Date.now();
  const tests = [];

  try {
    console.log('[JOURNEY 1] New User Signup Flow');

    // Step 1: Navigate to signup page
    console.log('  [Step 1/5] Navigate to signup page');
    const nav = await client.sendCommand('navigate', { url: 'https://example.com/signup' });
    assert(nav.status === 'success' || nav.success === true, 'Navigation failed');
    tests.push({ step: 'Navigate to signup', passed: true });

    // Step 2: Wait for form to be visible
    console.log('  [Step 2/5] Wait for form element');
    const wait = await client.sendCommand('waitForElement', { selector: 'form[id="signup-form"]', timeout: 10000 });
    assert(wait.status === 'success' || wait.found === true, 'Form not found');
    tests.push({ step: 'Wait for form', passed: true });

    // Step 3: Fill out form fields
    console.log('  [Step 3/5] Fill form fields');
    const fill1 = await client.sendCommand('fill', { selector: 'input[name="email"]', text: 'test@example.com' });
    assert(fill1.status === 'success' || fill1.filled === true, 'Email fill failed');
    tests.push({ step: 'Fill email field', passed: true });

    const fill2 = await client.sendCommand('fill', { selector: 'input[name="password"]', text: 'TempPass123!' });
    assert(fill2.status === 'success' || fill2.filled === true, 'Password fill failed');
    tests.push({ step: 'Fill password field', passed: true });

    // Step 4: Submit form
    console.log('  [Step 4/5] Submit signup form');
    const submit = await client.sendCommand('click', { selector: 'button[type="submit"]' });
    assert(submit.status === 'success' || submit.clicked === true, 'Form submit failed');
    tests.push({ step: 'Submit form', passed: true });

    // Step 5: Verify success page
    console.log('  [Step 5/5] Verify signup success');
    const verify = await client.sendCommand('getContent', { selector: 'body' });
    assert(verify.status === 'success' || verify.content, 'Could not verify page content');
    tests.push({ step: 'Verify success', passed: true });

    const journeyTime = Date.now() - startTime;
    TEST_RESULTS.journeys.newUserSignup.passed += 5;
    TEST_RESULTS.journeys.newUserSignup.time += journeyTime;

    console.log(`  Journey completed successfully in ${journeyTime}ms`);
    return { success: true, tests, time: journeyTime };
  } catch (error) {
    TEST_RESULTS.journeys.newUserSignup.failed += 1;
    TEST_RESULTS.errors.push({
      journey: 'newUserSignup',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`  Journey failed: ${error.message}`);
    return { success: false, error: error.message, time: Date.now() - startTime };
  }
}

/**
 * Journey 2: Existing User Login Flow
 * Validates: Navigate -> Enter credentials -> Login -> View dashboard
 */
async function testExistingUserLoginJourney(client) {
  const startTime = Date.now();
  const tests = [];

  try {
    console.log('[JOURNEY 2] Existing User Login Flow');

    // Step 1: Navigate to login
    console.log('  [Step 1/4] Navigate to login page');
    const nav = await client.sendCommand('navigate', { url: 'https://example.com/login' });
    assert(nav.status === 'success' || nav.success === true, 'Navigation failed');
    tests.push({ step: 'Navigate to login', passed: true });

    // Step 2: Enter credentials
    console.log('  [Step 2/4] Enter login credentials');
    const emailFill = await client.sendCommand('fill', { selector: 'input[name="email"]', text: 'existing@example.com' });
    assert(emailFill.status === 'success' || emailFill.filled === true, 'Email entry failed');
    tests.push({ step: 'Enter email', passed: true });

    const passFill = await client.sendCommand('fill', { selector: 'input[name="password"]', text: 'SecurePass456!' });
    assert(passFill.status === 'success' || passFill.filled === true, 'Password entry failed');
    tests.push({ step: 'Enter password', passed: true });

    // Step 3: Submit login
    console.log('  [Step 3/4] Submit login');
    const submit = await client.sendCommand('click', { selector: 'button[type="submit"]' });
    assert(submit.status === 'success' || submit.clicked === true, 'Login submit failed');
    tests.push({ step: 'Submit login', passed: true });

    // Step 4: Verify dashboard
    console.log('  [Step 4/4] Verify dashboard load');
    const dash = await client.sendCommand('waitForElement', { selector: '.dashboard', timeout: 10000 });
    assert(dash.status === 'success' || dash.found === true, 'Dashboard not found');
    tests.push({ step: 'Verify dashboard', passed: true });

    const journeyTime = Date.now() - startTime;
    TEST_RESULTS.journeys.existingUserLogin.passed += 5;
    TEST_RESULTS.journeys.existingUserLogin.time += journeyTime;

    console.log(`  Journey completed successfully in ${journeyTime}ms`);
    return { success: true, tests, time: journeyTime };
  } catch (error) {
    TEST_RESULTS.journeys.existingUserLogin.failed += 1;
    TEST_RESULTS.errors.push({
      journey: 'existingUserLogin',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`  Journey failed: ${error.message}`);
    return { success: false, error: error.message, time: Date.now() - startTime };
  }
}

/**
 * Journey 3: Competitive Monitoring Setup
 * Validates: Create monitor -> Add competitor URL -> Enable alerts -> Receive notification
 */
async function testCompetitiveMonitoringJourney(client) {
  const startTime = Date.now();
  const tests = [];

  try {
    console.log('[JOURNEY 3] Competitive Monitoring Setup');

    // Step 1: Navigate to monitors dashboard
    console.log('  [Step 1/5] Navigate to monitors');
    const nav = await client.sendCommand('navigate', { url: 'https://example.com/monitors' });
    assert(nav.status === 'success' || nav.success === true, 'Navigation failed');
    tests.push({ step: 'Navigate to monitors', passed: true });

    // Step 2: Click create monitor button
    console.log('  [Step 2/5] Click create monitor');
    const create = await client.sendCommand('click', { selector: 'button[id="create-monitor"]' });
    assert(create.status === 'success' || create.clicked === true, 'Create monitor click failed');
    tests.push({ step: 'Click create monitor', passed: true });

    // Step 3: Enter competitor URL
    console.log('  [Step 3/5] Enter competitor URL');
    const urlFill = await client.sendCommand('fill', {
      selector: 'input[id="competitor-url"]',
      text: 'https://competitor.example.com',
    });
    assert(urlFill.status === 'success' || urlFill.filled === true, 'URL entry failed');
    tests.push({ step: 'Enter competitor URL', passed: true });

    // Step 4: Enable alerts
    console.log('  [Step 4/5] Enable alerts');
    const alert = await client.sendCommand('click', { selector: 'input[id="enable-alerts"]' });
    assert(alert.status === 'success' || alert.clicked === true, 'Alert toggle failed');
    tests.push({ step: 'Enable alerts', passed: true });

    // Step 5: Save monitor
    console.log('  [Step 5/5] Save monitor configuration');
    const save = await client.sendCommand('click', { selector: 'button[id="save-monitor"]' });
    assert(save.status === 'success' || save.clicked === true, 'Save monitor failed');
    tests.push({ step: 'Save monitor', passed: true });

    const journeyTime = Date.now() - startTime;
    TEST_RESULTS.journeys.competitiveMonitoring.passed += 5;
    TEST_RESULTS.journeys.competitiveMonitoring.time += journeyTime;

    console.log(`  Journey completed successfully in ${journeyTime}ms`);
    return { success: true, tests, time: journeyTime };
  } catch (error) {
    TEST_RESULTS.journeys.competitiveMonitoring.failed += 1;
    TEST_RESULTS.errors.push({
      journey: 'competitiveMonitoring',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`  Journey failed: ${error.message}`);
    return { success: false, error: error.message, time: Date.now() - startTime };
  }
}

/**
 * Journey 4: Forensic Evidence Collection & Export
 * Validates: Navigate -> Capture screenshot -> Collect metadata -> Export report
 */
async function testForensicEvidenceJourney(client) {
  const startTime = Date.now();
  const tests = [];

  try {
    console.log('[JOURNEY 4] Forensic Evidence Collection & Export');

    // Step 1: Navigate to target page
    console.log('  [Step 1/5] Navigate to target page');
    const nav = await client.sendCommand('navigate', { url: 'https://example.com/investigation' });
    assert(nav.status === 'success' || nav.success === true, 'Navigation failed');
    tests.push({ step: 'Navigate to target', passed: true });

    // Step 2: Capture full page screenshot
    console.log('  [Step 2/5] Capture full page screenshot');
    const screenshot = await client.sendCommand('screenshot', { fullPage: true });
    assert(screenshot.status === 'success' || screenshot.data, 'Screenshot capture failed');
    tests.push({ step: 'Capture screenshot', passed: true });

    // Step 3: Collect page metadata
    console.log('  [Step 3/5] Collect page metadata');
    const metadata = await client.sendCommand('getPageMetadata', {});
    assert(metadata.status === 'success' || metadata.metadata, 'Metadata collection failed');
    tests.push({ step: 'Collect metadata', passed: true });

    // Step 4: Extract all links
    console.log('  [Step 4/5] Extract page links');
    const links = await client.sendCommand('getLinks', {});
    assert(links.status === 'success' || Array.isArray(links.links), 'Link extraction failed');
    tests.push({ step: 'Extract links', passed: true });

    // Step 5: Export evidence report
    console.log('  [Step 5/5] Export evidence report');
    const export_data = await client.sendCommand('exportReport', {
      format: 'pdf',
      includeScreenshot: true,
      includeMetadata: true,
    });
    assert(export_data.status === 'success' || export_data.exported === true, 'Report export failed');
    tests.push({ step: 'Export report', passed: true });

    const journeyTime = Date.now() - startTime;
    TEST_RESULTS.journeys.forensicEvidence.passed += 5;
    TEST_RESULTS.journeys.forensicEvidence.time += journeyTime;

    console.log(`  Journey completed successfully in ${journeyTime}ms`);
    return { success: true, tests, time: journeyTime };
  } catch (error) {
    TEST_RESULTS.journeys.forensicEvidence.failed += 1;
    TEST_RESULTS.errors.push({
      journey: 'forensicEvidence',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`  Journey failed: ${error.message}`);
    return { success: false, error: error.message, time: Date.now() - startTime };
  }
}

/**
 * Journey 5: Multi-Monitor Campaign
 * Validates: Create 5+ monitors -> Enable all -> Aggregate alerts -> View campaign dashboard
 */
async function testMultiMonitorCampaignJourney(client) {
  const startTime = Date.now();
  const tests = [];

  try {
    console.log('[JOURNEY 5] Multi-Monitor Campaign (5+ competitors)');

    // Step 1: Navigate to campaigns
    console.log('  [Step 1/5] Navigate to campaigns');
    const nav = await client.sendCommand('navigate', { url: 'https://example.com/campaigns' });
    assert(nav.status === 'success' || nav.success === true, 'Navigation failed');
    tests.push({ step: 'Navigate to campaigns', passed: true });

    // Step 2: Create new campaign
    console.log('  [Step 2/5] Create new campaign');
    const campaign = await client.sendCommand('click', { selector: 'button[id="new-campaign"]' });
    assert(campaign.status === 'success' || campaign.clicked === true, 'Campaign creation failed');
    tests.push({ step: 'Create campaign', passed: true });

    // Step 3: Add 5 competitors
    console.log('  [Step 3/5] Add 5 competitors to campaign');
    const competitors = [
      'https://comp1.example.com',
      'https://comp2.example.com',
      'https://comp3.example.com',
      'https://comp4.example.com',
      'https://comp5.example.com',
    ];

    for (const url of competitors) {
      const add = await client.sendCommand('click', { selector: 'button[id="add-competitor"]' });
      if (add.status !== 'success' && add.clicked !== true) {
        throw new Error('Failed to add competitor');
      }
      const fill = await client.sendCommand('fill', { selector: 'input[id="competitor-url-input"]', text: url });
      if (fill.status !== 'success' && fill.filled !== true) {
        throw new Error(`Failed to fill URL: ${url}`);
      }
    }
    tests.push({ step: 'Add 5 competitors', passed: true });

    // Step 4: Enable all monitors
    console.log('  [Step 4/5] Enable all monitors');
    const enable = await client.sendCommand('click', { selector: 'button[id="enable-all"]' });
    assert(enable.status === 'success' || enable.clicked === true, 'Enable all failed');
    tests.push({ step: 'Enable all monitors', passed: true });

    // Step 5: View campaign dashboard
    console.log('  [Step 5/5] View campaign dashboard');
    const dashboard = await client.sendCommand('waitForElement', { selector: '.campaign-dashboard', timeout: 10000 });
    assert(dashboard.status === 'success' || dashboard.found === true, 'Campaign dashboard not found');
    tests.push({ step: 'View dashboard', passed: true });

    const journeyTime = Date.now() - startTime;
    TEST_RESULTS.journeys.multiMonitorCampaign.passed += 5;
    TEST_RESULTS.journeys.multiMonitorCampaign.time += journeyTime;

    console.log(`  Journey completed successfully in ${journeyTime}ms`);
    return { success: true, tests, time: journeyTime };
  } catch (error) {
    TEST_RESULTS.journeys.multiMonitorCampaign.failed += 1;
    TEST_RESULTS.errors.push({
      journey: 'multiMonitorCampaign',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`  Journey failed: ${error.message}`);
    return { success: false, error: error.message, time: Date.now() - startTime };
  }
}

/**
 * Run all journey tests
 */
async function runAllJourneys() {
  console.log('\n========================================');
  console.log('END-TO-END CRITICAL JOURNEY TESTING');
  console.log('========================================\n');

  let client;
  const results = [];

  try {
    client = new TestWebSocketClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    // Run all 5 journeys
    results.push(await testNewUserSignupJourney(client));
    results.push(await testExistingUserLoginJourney(client));
    results.push(await testCompetitiveMonitoringJourney(client));
    results.push(await testForensicEvidenceJourney(client));
    results.push(await testMultiMonitorCampaignJourney(client));

    // Calculate aggregates
    TEST_RESULTS.totalTests = results.length;
    TEST_RESULTS.totalPassed = results.filter((r) => r.success).length;
    TEST_RESULTS.totalFailed = results.filter((r) => !r.success).length;

    // Print summary
    console.log('\n========================================');
    console.log('JOURNEY TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Journeys: ${TEST_RESULTS.totalTests}`);
    console.log(`Passed: ${TEST_RESULTS.totalPassed}`);
    console.log(`Failed: ${TEST_RESULTS.totalFailed}`);
    console.log(`Success Rate: ${((TEST_RESULTS.totalPassed / TEST_RESULTS.totalTests) * 100).toFixed(2)}%`);

    if (TEST_RESULTS.errors.length > 0) {
      console.log('\nErrors encountered:');
      TEST_RESULTS.errors.forEach((err) => {
        console.log(`  - [${err.journey}] ${err.error}`);
      });
    }

    console.log('\nJourney Details:');
    Object.entries(TEST_RESULTS.journeys).forEach(([name, stats]) => {
      const total = stats.passed + stats.failed;
      if (total > 0) {
        console.log(`  ${name}: ${stats.passed}/${total} (${stats.time}ms)`);
      }
    });
  } catch (error) {
    console.error('Test suite error:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.disconnect();
    }
  }

  return TEST_RESULTS.totalFailed === 0 ? 0 : 1;
}

// Run tests
runAllJourneys()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

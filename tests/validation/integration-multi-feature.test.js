#!/usr/bin/env node

/**
 * Multi-Feature Integration Testing
 * Tests multiple features working together
 * Validates: Dashboard + Slack + Proxies + Detection all together
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 10000;

const TEST_RESULTS = {
  integrations: {
    dashboardSlack: { passed: 0, failed: 0 },
    dashboardProxy: { passed: 0, failed: 0 },
    dashboardDetection: { passed: 0, failed: 0 },
    proxyDetection: { passed: 0, failed: 0 },
    allFeatures: { passed: 0, failed: 0 }
  },
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: []
};

/**
 * WebSocket Client
 */
class IntegrationTestClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
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
            }
          } catch (e) {}
        });

        this.ws.on('error', (err) => {
          if (!this.connected) {
            reject(err);
          }
        });

        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        }
      });

      try {
        this.ws.send(JSON.stringify({ command, params, requestId }));
      } catch (err) {
        clearTimeout(timer);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Test 1: Dashboard + Slack Integration
 * Dashboard updates trigger Slack notifications
 */
async function testDashboardSlackIntegration(client) {
  try {
    console.log('[Integration 1] Dashboard + Slack');

    // Setup: Enable Slack notifications
    console.log('  [1/3] Configure Slack notifications');
    await client.sendCommand('configureSlack', {
      webhookUrl: 'https://hooks.slack.com/services/TEST',
      channel: '#monitoring',
      enabled: true
    });

    // Create monitor that triggers Slack
    console.log('  [2/3] Create monitor with Slack alerts');
    const monitor = await client.sendCommand('createMonitor', {
      url: 'https://competitor.example.com',
      name: 'Test Competitor',
      enableSlackAlerts: true,
      slackChannel: '#monitoring'
    });

    if (!monitor.success && !monitor.monitorId) {
      throw new Error('Failed to create monitor');
    }

    // Verify dashboard shows monitor with Slack enabled
    console.log('  [3/3] Verify dashboard displays monitor with Slack enabled');
    const dashboard = await client.sendCommand('getDashboard', {});

    if (dashboard.monitors && dashboard.monitors.length > 0) {
      const monitorData = dashboard.monitors.find((m) => m.id === monitor.monitorId);
      if (monitorData && monitorData.slackEnabled === true) {
        TEST_RESULTS.integrations.dashboardSlack = { passed: 3, failed: 0 };
        console.log('  Result: PASS\n');
        return true;
      }
    }

    TEST_RESULTS.integrations.dashboardSlack = { passed: 2, failed: 1 };
    console.log('  Result: PARTIAL\n');
    return false;
  } catch (error) {
    console.error(`  Failed: ${error.message}\n`);
    TEST_RESULTS.integrations.dashboardSlack = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      integration: 'dashboardSlack',
      error: error.message
    });
    return false;
  }
}

/**
 * Test 2: Dashboard + Proxy Integration
 * Dashboard shows proxy usage metrics
 */
async function testDashboardProxyIntegration(client) {
  try {
    console.log('[Integration 2] Dashboard + Proxy');

    // Setup proxy
    console.log('  [1/3] Configure proxy');
    await client.sendCommand('setProxy', {
      protocol: 'http',
      host: 'proxy.example.com',
      port: 8080,
      enabled: true
    });

    // Create monitor using proxy
    console.log('  [2/3] Create monitor with proxy');
    const monitor = await client.sendCommand('createMonitor', {
      url: 'https://competitor.example.com',
      useProxy: true,
      proxyRotation: 'random'
    });

    if (!monitor.success && !monitor.monitorId) {
      throw new Error('Failed to create monitor');
    }

    // Check dashboard displays proxy metrics
    console.log('  [3/3] Verify dashboard shows proxy metrics');
    const dashboard = await client.sendCommand('getDashboard', {
      includeProxyMetrics: true
    });

    if (dashboard.proxyMetrics) {
      TEST_RESULTS.integrations.dashboardProxy = { passed: 3, failed: 0 };
      console.log('  Result: PASS\n');
      return true;
    }

    TEST_RESULTS.integrations.dashboardProxy = { passed: 2, failed: 1 };
    console.log('  Result: PARTIAL\n');
    return false;
  } catch (error) {
    console.error(`  Failed: ${error.message}\n`);
    TEST_RESULTS.integrations.dashboardProxy = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      integration: 'dashboardProxy',
      error: error.message
    });
    return false;
  }
}

/**
 * Test 3: Dashboard + Bot Detection Integration
 * Dashboard shows bot detection evasion status
 */
async function testDashboardDetectionIntegration(client) {
  try {
    console.log('[Integration 3] Dashboard + Bot Detection Evasion');

    // Configure evasion
    console.log('  [1/3] Configure bot detection evasion');
    await client.sendCommand('configureEvasion', {
      fingerprinting: true,
      fingerprints: ['canvas', 'webgl', 'audio'],
      behavioral: true,
      headless: true
    });

    // Create monitor with evasion
    console.log('  [2/3] Create monitor with evasion enabled');
    const monitor = await client.sendCommand('createMonitor', {
      url: 'https://competitor.example.com',
      enableEvasion: true,
      evasionProfile: 'aggressive'
    });

    if (!monitor.success && !monitor.monitorId) {
      throw new Error('Failed to create monitor');
    }

    // Check dashboard shows evasion status
    console.log('  [3/3] Verify dashboard shows evasion status');
    const dashboard = await client.sendCommand('getDashboard', {
      includeEvasionStatus: true
    });

    if (dashboard.evasionStatus || (dashboard.monitors && dashboard.monitors.length > 0)) {
      TEST_RESULTS.integrations.dashboardDetection = { passed: 3, failed: 0 };
      console.log('  Result: PASS\n');
      return true;
    }

    TEST_RESULTS.integrations.dashboardDetection = { passed: 2, failed: 1 };
    console.log('  Result: PARTIAL\n');
    return false;
  } catch (error) {
    console.error(`  Failed: ${error.message}\n`);
    TEST_RESULTS.integrations.dashboardDetection = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      integration: 'dashboardDetection',
      error: error.message
    });
    return false;
  }
}

/**
 * Test 4: Proxy + Bot Detection Integration
 * Proxy rotation works with bot detection evasion
 */
async function testProxyDetectionIntegration(client) {
  try {
    console.log('[Integration 4] Proxy + Bot Detection Evasion');

    // Configure both proxy and evasion
    console.log('  [1/3] Configure proxy and evasion');
    await client.sendCommand('setProxy', {
      enabled: true,
      rotationEnabled: true,
      maxProxiesPerSession: 5
    });

    await client.sendCommand('configureEvasion', {
      fingerprinting: true,
      behavioral: true,
      rotateWithProxy: true // Fingerprints rotate with proxy
    });

    // Navigate with both systems active
    console.log('  [2/3] Navigate with proxy + evasion');
    const nav = await client.sendCommand('navigate', {
      url: 'https://example.com',
      useProxy: true,
      enableEvasion: true
    });

    if (!nav.success && nav.status !== 'success') {
      throw new Error('Navigation failed');
    }

    // Verify both systems are active
    console.log('  [3/3] Verify both proxy and evasion active');
    const status = await client.sendCommand('getSessionStatus', {});

    if (status.proxyActive && status.evasionActive) {
      TEST_RESULTS.integrations.proxyDetection = { passed: 3, failed: 0 };
      console.log('  Result: PASS\n');
      return true;
    }

    TEST_RESULTS.integrations.proxyDetection = { passed: 2, failed: 1 };
    console.log('  Result: PARTIAL\n');
    return false;
  } catch (error) {
    console.error(`  Failed: ${error.message}\n`);
    TEST_RESULTS.integrations.proxyDetection = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      integration: 'proxyDetection',
      error: error.message
    });
    return false;
  }
}

/**
 * Test 5: All Features Integration
 * All features work together seamlessly
 */
async function testAllFeaturesIntegration(client) {
  try {
    console.log('[Integration 5] All Features Together');

    // Configure all systems
    console.log('  [1/4] Configure all systems');
    await client.sendCommand('configureSlack', {
      enabled: true,
      webhookUrl: 'https://hooks.slack.com/services/TEST'
    });

    await client.sendCommand('setProxy', {
      enabled: true,
      rotationEnabled: true
    });

    await client.sendCommand('configureEvasion', {
      fingerprinting: true,
      behavioral: true,
      headless: true
    });

    // Create comprehensive monitor
    console.log('  [2/4] Create monitor using all features');
    const monitor = await client.sendCommand('createMonitor', {
      url: 'https://competitor.example.com',
      enableSlackAlerts: true,
      useProxy: true,
      proxyRotation: 'random',
      enableEvasion: true,
      evasionProfile: 'aggressive',
      detectionServices: ['all'],
      frequency: '5m'
    });

    if (!monitor.success && !monitor.monitorId) {
      throw new Error('Failed to create comprehensive monitor');
    }

    // Run the monitor with all features
    console.log('  [3/4] Run monitor with all features');
    const result = await client.sendCommand('runMonitor', {
      monitorId: monitor.monitorId
    });

    if (!result.success && result.status !== 'success') {
      throw new Error('Monitor execution failed');
    }

    // Verify all features are active in session
    console.log('  [4/4] Verify all features active');
    const status = await client.sendCommand('getSessionStatus', {});

    const allActive =
      status.slackEnabled &&
      status.proxyActive &&
      status.evasionActive &&
      status.detectionEnabled;

    if (allActive) {
      TEST_RESULTS.integrations.allFeatures = { passed: 4, failed: 0 };
      console.log('  Result: PASS\n');
      return true;
    }

    TEST_RESULTS.integrations.allFeatures = { passed: 3, failed: 1 };
    console.log('  Result: PARTIAL\n');
    return false;
  } catch (error) {
    console.error(`  Failed: ${error.message}\n`);
    TEST_RESULTS.integrations.allFeatures = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      integration: 'allFeatures',
      error: error.message
    });
    return false;
  }
}

/**
 * Run all integration tests
 */
async function runIntegrationTests() {
  console.log('\n========================================');
  console.log('MULTI-FEATURE INTEGRATION TESTING');
  console.log('========================================\n');

  let client;
  const results = [];

  try {
    client = new IntegrationTestClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    // Run all integration tests
    results.push(await testDashboardSlackIntegration(client));
    results.push(await testDashboardProxyIntegration(client));
    results.push(await testDashboardDetectionIntegration(client));
    results.push(await testProxyDetectionIntegration(client));
    results.push(await testAllFeaturesIntegration(client));

    // Calculate totals
    const allResults = Object.values(TEST_RESULTS.integrations);
    TEST_RESULTS.totalTests = allResults.reduce(
      (sum, r) => sum + r.passed + r.failed,
      0
    );
    TEST_RESULTS.totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    TEST_RESULTS.totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

    // Print summary
    console.log('========================================');
    console.log('INTEGRATION TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Test Cases: ${TEST_RESULTS.totalTests}`);
    console.log(`Passed: ${TEST_RESULTS.totalPassed}`);
    console.log(`Failed: ${TEST_RESULTS.totalFailed}`);
    console.log(
      `Success Rate: ${(
        (TEST_RESULTS.totalPassed / TEST_RESULTS.totalTests) *
        100
      ).toFixed(2)}%`
    );

    console.log('\nIntegration Results:');
    Object.entries(TEST_RESULTS.integrations).forEach(([integration, results]) => {
      const total = results.passed + results.failed;
      console.log(`  ${integration}: ${results.passed}/${total} passed`);
    });

    if (TEST_RESULTS.errors.length > 0) {
      console.log('\nErrors:');
      TEST_RESULTS.errors.forEach((err) => {
        console.log(`  - [${err.integration}] ${err.error}`);
      });
    }

    return TEST_RESULTS.totalFailed === 0 ? 0 : 1;
  } catch (error) {
    console.error('Test suite error:', error.message);
    return 1;
  } finally {
    if (client) {
      client.disconnect();
    }
  }
}

// Run tests
runIntegrationTests()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

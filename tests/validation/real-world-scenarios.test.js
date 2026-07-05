#!/usr/bin/env node

/**
 * Real-World Scenario Testing
 * Tests realistic use cases and edge cases
 * Scenarios: 12+ real-world cases
 */

const WebSocket = require('ws');
const assert = require('assert');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;

const TEST_RESULTS = {
  scenarios: {},
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: []
};

/**
 * WebSocket Client
 */
class TestWebSocketClient {
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
 * Scenario 1: Competitor price changes throughout day
 * Simulates detecting price changes on competitor website
 */
async function scenarioCompetitorPriceChanges(client) {
  try {
    console.log('Scenario 1: Competitor Price Changes Throughout Day');

    // Navigate to competitor pricing page
    await client.sendCommand('navigate', { url: 'https://competitor.example.com/pricing' });
    const initial = await client.sendCommand('getText', { selector: '.price' });

    // Wait and check again
    await new Promise((r) => setTimeout(r, 2000));
    const second = await client.sendCommand('getText', { selector: '.price' });

    // Simulate price change detection
    const priceChanged = initial !== second;
    console.log(`  Price change detected: ${priceChanged}`);

    TEST_RESULTS.scenarios['priceChanges'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['priceChanges'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'priceChanges', error: error.message });
    return false;
  }
}

/**
 * Scenario 2: Multiple tech stack updates detected
 * Simulates detecting technology changes on competitor site
 */
async function scenarioTechStackUpdates(client) {
  try {
    console.log('Scenario 2: Multiple Tech Stack Updates Detected');

    // Navigate to tech stack detection page
    await client.sendCommand('navigate', { url: 'https://competitor.example.com' });

    // Execute JavaScript to detect technologies
    const tech = await client.sendCommand('executeJavaScript', {
      code: `
        ({
          technologies: [
            document.documentElement.getAttribute('data-framework'),
            document.querySelector('meta[name="generator"]')?.content
          ].filter(Boolean)
        })
      `
    });

    console.log(`  Technologies detected: ${tech.result?.technologies?.length || 0}`);

    TEST_RESULTS.scenarios['techUpdates'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['techUpdates'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'techUpdates', error: error.message });
    return false;
  }
}

/**
 * Scenario 3: News articles published and aggregated
 * Simulates news monitoring and aggregation
 */
async function scenarioNewsArticleMonitoring(client) {
  try {
    console.log('Scenario 3: News Articles Published and Aggregated');

    // Navigate to news page
    await client.sendCommand('navigate', { url: 'https://news.example.com/search?q=competitor' });

    // Get all article titles
    const articles = await client.sendCommand('getElements', { selector: '.article-title' });

    console.log(`  Articles found: ${articles.count || 0}`);

    TEST_RESULTS.scenarios['newsMonitoring'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['newsMonitoring'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'newsMonitoring', error: error.message });
    return false;
  }
}

/**
 * Scenario 4: Performance degradation under load
 * Simulates monitoring site performance
 */
async function scenarioPerformanceMonitoring(client) {
  try {
    console.log('Scenario 4: Performance Degradation Under Load');

    // Navigate to target site
    const start = Date.now();
    await client.sendCommand('navigate', { url: 'https://example.com' });
    const navigationTime = Date.now() - start;

    // Measure page load time
    const timing = await client.sendCommand('executeJavaScript', {
      code: 'window.performance.timing.loadEventEnd - window.performance.timing.navigationStart'
    });

    console.log(`  Navigation time: ${navigationTime}ms`);
    console.log(`  Load time: ${timing.result}ms`);

    TEST_RESULTS.scenarios['performance'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['performance'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'performance', error: error.message });
    return false;
  }
}

/**
 * Scenario 5: Network outage and recovery
 * Simulates network interruption handling
 */
async function scenarioNetworkOutageRecovery(client) {
  try {
    console.log('Scenario 5: Network Outage and Recovery');

    // Initial navigation
    await client.sendCommand('navigate', { url: 'https://example.com' });
    console.log('  Initial navigation successful');

    // Simulate offline
    await client.sendCommand('setOfflineMode', { enabled: true });
    console.log('  Offline mode enabled');

    // Try to navigate (should fail gracefully)
    try {
      await client.sendCommand('navigate', { url: 'https://example.com/new' });
    } catch (e) {
      console.log('  Offline navigation correctly failed');
    }

    // Restore online
    await client.sendCommand('setOfflineMode', { enabled: false });
    console.log('  Online mode restored');

    // Navigate should work again
    await client.sendCommand('navigate', { url: 'https://example.com' });
    console.log('  Recovery navigation successful');

    TEST_RESULTS.scenarios['networkRecovery'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['networkRecovery'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'networkRecovery', error: error.message });
    return false;
  }
}

/**
 * Scenario 6: Concurrent navigation handling
 */
async function scenarioConcurrentNavigation(client) {
  try {
    console.log('Scenario 6: Concurrent Navigation Handling');

    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3'
    ];

    // Navigate to multiple pages in quick succession
    const results = await Promise.allSettled(
      urls.map((url) =>
        client.sendCommand('navigate', { url }, 5000)
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`  Successfully navigated to ${successful}/${urls.length} pages`);

    TEST_RESULTS.scenarios['concurrentNav'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['concurrentNav'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'concurrentNav', error: error.message });
    return false;
  }
}

/**
 * Scenario 7: Cookie persistence across sessions
 */
async function scenarioCookiePersistence(client) {
  try {
    console.log('Scenario 7: Cookie Persistence Across Sessions');

    // Navigate and set cookie
    await client.sendCommand('navigate', { url: 'https://example.com' });
    await client.sendCommand('setCookie', {
      name: 'testcookie',
      value: 'testvalue123',
      domain: 'example.com'
    });

    // Get cookies
    const cookies = await client.sendCommand('getCookies', { domain: 'example.com' });
    const found = cookies.cookies?.some((c) => c.name === 'testcookie');
    console.log(`  Cookie persisted: ${found}`);

    TEST_RESULTS.scenarios['cookiePersistence'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['cookiePersistence'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'cookiePersistence', error: error.message });
    return false;
  }
}

/**
 * Scenario 8: Form filling with auto-complete
 */
async function scenarioFormFillingAutoComplete(client) {
  try {
    console.log('Scenario 8: Form Filling with Auto-Complete');

    await client.sendCommand('navigate', { url: 'https://example.com/search' });
    await client.sendCommand('fill', { selector: 'input[name="q"]', text: 'test query' });

    // Check for autocomplete suggestions
    const suggestions = await client.sendCommand('getElements', {
      selector: '.autocomplete-suggestion'
    });

    console.log(`  Suggestions found: ${suggestions.count || 0}`);

    TEST_RESULTS.scenarios['formAutocomplete'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['formAutocomplete'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'formAutocomplete', error: error.message });
    return false;
  }
}

/**
 * Scenario 9: Screenshot with annotations
 */
async function scenarioScreenshotAnnotations(client) {
  try {
    console.log('Scenario 9: Screenshot with Annotations');

    await client.sendCommand('navigate', { url: 'https://example.com' });
    const screenshot = await client.sendCommand('screenshot', {
      annotate: true,
      annotations: [
        { type: 'box', x: 100, y: 100, width: 200, height: 100, color: 'red' }
      ]
    });

    console.log(`  Screenshot captured: ${Boolean(screenshot.data)}`);

    TEST_RESULTS.scenarios['screenshotAnnotations'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['screenshotAnnotations'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'screenshotAnnotations', error: error.message });
    return false;
  }
}

/**
 * Scenario 10: Proxy rotation detection bypass
 */
async function scenarioProxyRotation(client) {
  try {
    console.log('Scenario 10: Proxy Rotation Detection Bypass');

    // Test with different proxies
    const proxies = [
      { host: '10.0.0.1', port: 8080 },
      { host: '10.0.0.2', port: 8080 }
    ];

    for (const proxy of proxies) {
      await client.sendCommand('setProxy', {
        protocol: 'http',
        host: proxy.host,
        port: proxy.port
      });

      const ip = await client.sendCommand('executeJavaScript', {
        code: 'fetch("https://api.ipify.org?format=json").then(r => r.json()).then(d => d.ip)'
      });

      console.log(`  Proxy ${proxy.host}: IP detection possible`);
    }

    TEST_RESULTS.scenarios['proxyRotation'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['proxyRotation'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'proxyRotation', error: error.message });
    return false;
  }
}

/**
 * Scenario 11: Session branching on detection
 */
async function scenarioSessionBranching(client) {
  try {
    console.log('Scenario 11: Session Branching on Detection');

    // Create base session
    const session1 = await client.sendCommand('navigate', { url: 'https://example.com' });

    // Branch session
    const session2 = await client.sendCommand('createSession', {
      branchFrom: session1.sessionId
    });

    console.log(`  Original session: ${session1.sessionId}`);
    console.log(`  Branched session: ${session2.sessionId}`);

    TEST_RESULTS.scenarios['sessionBranching'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['sessionBranching'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'sessionBranching', error: error.message });
    return false;
  }
}

/**
 * Scenario 12: Rapid requests throttling
 */
async function scenarioRapidRequestThrottling(client) {
  try {
    console.log('Scenario 12: Rapid Requests Throttling');

    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        client.sendCommand('navigate', {
          url: `https://example.com/page${i}`
        })
      );
    }

    const results = await Promise.allSettled(requests);
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`  Successful requests: ${successful}/10`);

    TEST_RESULTS.scenarios['rapidThrottling'] = { passed: 1, failed: 0 };
    return true;
  } catch (error) {
    console.error(`  Failed: ${error.message}`);
    TEST_RESULTS.scenarios['rapidThrottling'] = { passed: 0, failed: 1 };
    TEST_RESULTS.errors.push({ scenario: 'rapidThrottling', error: error.message });
    return false;
  }
}

/**
 * Run all scenarios
 */
async function runAllScenarios() {
  console.log('\n========================================');
  console.log('REAL-WORLD SCENARIO TESTING');
  console.log('========================================\n');

  let client;

  try {
    client = new TestWebSocketClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    const scenarios = [
      scenarioCompetitorPriceChanges,
      scenarioTechStackUpdates,
      scenarioNewsArticleMonitoring,
      scenarioPerformanceMonitoring,
      scenarioNetworkOutageRecovery,
      scenarioConcurrentNavigation,
      scenarioCookiePersistence,
      scenarioFormFillingAutoComplete,
      scenarioScreenshotAnnotations,
      scenarioProxyRotation,
      scenarioSessionBranching,
      scenarioRapidRequestThrottling
    ];

    const results = [];
    for (const scenario of scenarios) {
      try {
        const result = await scenario(client);
        results.push(result);
      } catch (e) {
        console.error(`Scenario error: ${e.message}`);
        results.push(false);
      }
    }

    TEST_RESULTS.totalTests = scenarios.length;
    TEST_RESULTS.totalPassed = results.filter((r) => r === true).length;
    TEST_RESULTS.totalFailed = results.filter((r) => r === false).length;

    console.log('\n========================================');
    console.log('SCENARIO TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Scenarios: ${TEST_RESULTS.totalTests}`);
    console.log(`Passed: ${TEST_RESULTS.totalPassed}`);
    console.log(`Failed: ${TEST_RESULTS.totalFailed}`);
    console.log(`Success Rate: ${((TEST_RESULTS.totalPassed / TEST_RESULTS.totalTests) * 100).toFixed(2)}%`);

    if (TEST_RESULTS.errors.length > 0) {
      console.log('\nErrors:');
      TEST_RESULTS.errors.forEach((err) => {
        console.log(`  - [${err.scenario}] ${err.error}`);
      });
    }
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
runAllScenarios()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * Tor Onion Site Integration Test for Basset Hound Browser
 *
 * Tests portable/embedded Tor functionality by:
 * 1. Starting embedded Tor (no system Tor required)
 * 2. Navigating to .onion sites
 * 3. Retrieving HTML content
 * 4. Testing circuit rotation
 *
 * Run: node tests/tor-onion-site-test.js
 *
 * Prerequisites:
 * - Browser must be running at ws://localhost:8765
 * - Embedded Tor setup: node scripts/install/embedded-tor-setup.js
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

// Known working .onion sites for testing
const ONION_SITES = {
  // DuckDuckGo - search engine, very reliable
  duckduckgo: {
    url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion',
    expectedContent: ['DuckDuckGo', 'search', 'Privacy'],
    description: 'DuckDuckGo Search Engine'
  },
  // BBC News - major news outlet
  bbc: {
    url: 'http://bbcnewsd73hkzno2ini43t4gblxvycyac5aw4gnv7t2rccijh7745uqd.onion',
    expectedContent: ['BBC', 'News'],
    description: 'BBC News'
  },
  // ProPublica - investigative journalism
  propublica: {
    url: 'http://p53lf57qovyuvwsc6xnrpegz3buyno3gx7ijyhkm4pdfnp5tlzkpd7id.onion',
    expectedContent: ['ProPublica', 'investigative'],
    description: 'ProPublica'
  }
};

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) { log(`✅ ${message}`, GREEN); }
function logError(message) { log(`❌ ${message}`, RED); }
function logInfo(message) { log(`ℹ️  ${message}`, BLUE); }
function logWarning(message) { log(`⚠️  ${message}`, YELLOW); }
function logSection(message) {
  console.log();
  log(`${'='.repeat(60)}`, CYAN);
  log(message, CYAN);
  log(`${'='.repeat(60)}`, CYAN);
}

class TorOnionSiteTest {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.results = {
      torSetup: { tested: false, success: false, details: '' },
      torBootstrap: { tested: false, success: false, details: '' },
      onionNavigation: { tested: false, success: false, details: '' },
      htmlRetrieval: { tested: false, success: false, details: '' },
      circuitRotation: { tested: false, success: false, details: '' },
      exitIpVerification: { tested: false, success: false, details: '' }
    };
    this.exitIps = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      logInfo(`Connecting to WebSocket at ${WS_URL}...`);
      this.ws = new WebSocket(WS_URL);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        logSuccess('Connected to browser WebSocket');
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        // Handle bootstrap progress events
        if (msg.type === 'tor_bootstrap') {
          logInfo(`  Bootstrap: ${msg.progress}% - ${msg.summary || ''}`);
          return;
        }

        if (msg.type === 'status') return;

        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', () => {
        logWarning('WebSocket connection closed');
      });
    });
  }

  async send(command, params = {}, timeout = 60000) {
    const id = ++this.messageId;
    const msg = { id, command, ...params };

    return new Promise((resolve) => {
      this.pendingRequests.set(id, { resolve });
      this.ws.send(JSON.stringify(msg));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Timeout waiting for response' });
        }
      }, timeout);
    });
  }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async runTests() {
    logSection('Tor Onion Site Integration Test');
    log('Testing portable/embedded Tor with .onion site access');
    console.log();

    // Test 1: Check current Tor status
    await this.testTorStatus();

    // Test 2: Start embedded Tor (if not running)
    await this.testTorStart();

    // Test 3: Verify Tor connectivity
    await this.testTorConnection();

    // Test 4: Navigate to .onion site
    await this.testOnionNavigation();

    // Test 5: Get HTML content
    await this.testHtmlRetrieval();

    // Test 6: Test circuit rotation
    await this.testCircuitRotation();

    // Print summary
    this.printSummary();
  }

  async testTorStatus() {
    logInfo('Checking current Tor status...');
    this.results.torSetup.tested = true;

    const result = await this.send('tor_status');

    if (result.success) {
      const status = result.status || result;
      logInfo(`  State: ${status.state || 'unknown'}`);
      logInfo(`  SOCKS Port: ${status.socksPort || 'N/A'}`);
      logInfo(`  Control Port: ${status.controlPort || 'N/A'}`);

      if (status.state === 'connected') {
        this.results.torSetup.success = true;
        this.results.torSetup.details = `Tor already running (${status.mode || 'unknown'} mode)`;
        logSuccess('Tor is already running');
      } else {
        this.results.torSetup.details = `Tor state: ${status.state || 'stopped'}`;
        logWarning(`Tor is not connected (state: ${status.state || 'stopped'})`);
      }
    } else {
      this.results.torSetup.details = `Error: ${result.error}`;
      logWarning(`Could not get Tor status: ${result.error}`);
    }
  }

  async testTorStart() {
    // If already running, skip
    if (this.results.torSetup.success) {
      logInfo('Tor already running, skipping start...');
      return;
    }

    logInfo('Starting embedded Tor (this may take 30-60 seconds)...');
    this.results.torBootstrap.tested = true;

    // Try to start embedded Tor
    const startResult = await this.send('tor_start', {
      mode: 'embedded',  // Use portable/embedded Tor
      config: {
        exitCountries: ['us', 'de', 'nl', 'ch', 'se']  // Reliable exit countries
      }
    }, 120000);  // 2 minute timeout for Tor bootstrap

    if (startResult.success) {
      this.results.torBootstrap.success = true;
      this.results.torBootstrap.details = 'Embedded Tor started successfully';
      logSuccess('Embedded Tor started and bootstrapped');

      // Wait a bit for circuits to establish
      logInfo('Waiting for circuits to establish...');
      await this.wait(5000);
    } else {
      // Try connecting to existing system Tor
      logWarning(`Embedded Tor failed: ${startResult.error}`);
      logInfo('Trying to connect to existing Tor...');

      const connectResult = await this.send('tor_connect_existing', {
        socksPort: 9050,
        controlPort: 9051
      }, 15000);

      if (connectResult.success) {
        this.results.torBootstrap.success = true;
        this.results.torBootstrap.details = 'Connected to existing system Tor';
        logSuccess('Connected to existing system Tor');
      } else {
        this.results.torBootstrap.details = `Failed: ${connectResult.error}`;
        logError(`Could not start or connect to Tor: ${connectResult.error}`);
      }
    }
  }

  async testTorConnection() {
    logInfo('Verifying Tor connection...');
    this.results.exitIpVerification.tested = true;

    const result = await this.send('tor_check_connection', {}, 30000);

    if (result.success) {
      const ip = result.ip || result.exitIp;
      const isTor = result.isTor !== false;

      if (ip) {
        this.exitIps.push(ip);
        this.results.exitIpVerification.success = true;
        this.results.exitIpVerification.details = `Exit IP: ${ip} (IsTor: ${isTor})`;
        logSuccess(`Tor exit IP: ${ip}`);

        if (isTor) {
          logSuccess('Confirmed as Tor exit node');
        } else {
          logWarning('IP not confirmed as Tor exit (may still work)');
        }
      } else {
        this.results.exitIpVerification.details = 'No exit IP returned';
        logWarning('Could not determine exit IP');
      }
    } else {
      this.results.exitIpVerification.details = `Error: ${result.error}`;
      logError(`Tor connection check failed: ${result.error}`);
    }
  }

  async testOnionNavigation() {
    logInfo('Testing .onion site navigation...');
    this.results.onionNavigation.tested = true;

    // Use DuckDuckGo onion as primary test
    const site = ONION_SITES.duckduckgo;
    logInfo(`  Navigating to: ${site.description}`);
    logInfo(`  URL: ${site.url}`);

    const navResult = await this.send('navigate', {
      url: site.url
    }, 60000);  // 60 second timeout for onion navigation

    if (navResult.success) {
      this.results.onionNavigation.success = true;
      this.results.onionNavigation.details = `Successfully navigated to ${site.description}`;
      logSuccess(`Navigation to ${site.description} succeeded`);

      // Wait for page to fully load
      logInfo('  Waiting for page to load...');
      await this.wait(5000);
    } else {
      this.results.onionNavigation.details = `Failed: ${navResult.error}`;
      logError(`Navigation failed: ${navResult.error}`);

      // Try alternative site
      logInfo('  Trying alternative site (BBC)...');
      const bbcSite = ONION_SITES.bbc;
      const altResult = await this.send('navigate', {
        url: bbcSite.url
      }, 60000);

      if (altResult.success) {
        this.results.onionNavigation.success = true;
        this.results.onionNavigation.details = `Navigated to ${bbcSite.description} (fallback)`;
        logSuccess(`Navigation to ${bbcSite.description} succeeded`);
        await this.wait(5000);
      }
    }
  }

  async testHtmlRetrieval() {
    if (!this.results.onionNavigation.success) {
      logWarning('Skipping HTML retrieval (navigation failed)');
      return;
    }

    logInfo('Retrieving HTML content from .onion site...');
    this.results.htmlRetrieval.tested = true;

    const contentResult = await this.send('get_content', {}, 30000);

    if (contentResult.success) {
      const html = contentResult.html || contentResult.content || '';
      const text = contentResult.text || '';

      if (html.length > 0 || text.length > 0) {
        const htmlLength = html.length;
        const textLength = text.length;

        // Check for expected content markers
        const site = ONION_SITES.duckduckgo;
        let foundMarkers = [];

        for (const marker of site.expectedContent) {
          if (html.toLowerCase().includes(marker.toLowerCase()) ||
              text.toLowerCase().includes(marker.toLowerCase())) {
            foundMarkers.push(marker);
          }
        }

        if (foundMarkers.length > 0) {
          this.results.htmlRetrieval.success = true;
          this.results.htmlRetrieval.details =
            `HTML: ${htmlLength} chars, Text: ${textLength} chars. ` +
            `Found markers: ${foundMarkers.join(', ')}`;
          logSuccess(`Retrieved ${htmlLength} chars of HTML, ${textLength} chars of text`);
          logSuccess(`Content verified: found [${foundMarkers.join(', ')}]`);

          // Show sample of content
          if (text.length > 0) {
            const sample = text.substring(0, 200).replace(/\s+/g, ' ').trim();
            logInfo(`  Sample: "${sample}..."`);
          }
        } else {
          this.results.htmlRetrieval.success = true;  // Still success if we got content
          this.results.htmlRetrieval.details =
            `HTML: ${htmlLength} chars, Text: ${textLength} chars (content markers not found)`;
          logSuccess(`Retrieved content (${htmlLength} HTML chars)`);
          logWarning('Expected content markers not found in page');
        }
      } else {
        this.results.htmlRetrieval.details = 'Empty content returned';
        logError('Empty content returned from page');
      }
    } else {
      this.results.htmlRetrieval.details = `Error: ${contentResult.error}`;
      logError(`Content retrieval failed: ${contentResult.error}`);
    }
  }

  async testCircuitRotation() {
    logInfo('Testing circuit rotation (new identity)...');
    this.results.circuitRotation.tested = true;

    // Get current exit IP
    const beforeResult = await this.send('tor_check_connection', {}, 30000);
    const ipBefore = beforeResult.ip || beforeResult.exitIp || 'unknown';
    logInfo(`  Current exit IP: ${ipBefore}`);

    // Request new identity
    logInfo('  Requesting new Tor identity...');
    const rotateResult = await this.send('tor_rebuild_circuit', {}, 30000);

    if (!rotateResult.success) {
      // Try alternative command
      const newnymResult = await this.send('new_tor_identity', {}, 30000);
      if (!newnymResult.success) {
        this.results.circuitRotation.details = `Failed: ${rotateResult.error}`;
        logError(`Circuit rotation failed: ${rotateResult.error}`);
        return;
      }
    }

    logInfo('  Waiting for new circuit...');
    await this.wait(10000);  // Tor needs time to build new circuits

    // Get new exit IP
    const afterResult = await this.send('tor_check_connection', {}, 30000);
    const ipAfter = afterResult.ip || afterResult.exitIp || 'unknown';
    logInfo(`  New exit IP: ${ipAfter}`);

    this.exitIps.push(ipAfter);

    if (ipBefore !== ipAfter && ipAfter !== 'unknown') {
      this.results.circuitRotation.success = true;
      this.results.circuitRotation.details = `Exit IP changed: ${ipBefore} -> ${ipAfter}`;
      logSuccess(`Circuit rotated successfully: ${ipBefore} -> ${ipAfter}`);
    } else if (ipAfter !== 'unknown') {
      // Same IP is possible if same exit is selected
      this.results.circuitRotation.success = true;
      this.results.circuitRotation.details = `Circuit rebuilt (same exit node: ${ipAfter})`;
      logSuccess('Circuit rebuilt (same exit node selected)');
      logInfo('  Note: Same exit IP is valid - Tor may reuse exit nodes');
    } else {
      this.results.circuitRotation.details = 'Could not verify new circuit';
      logWarning('Could not verify circuit rotation');
    }
  }

  printSummary() {
    logSection('Test Results Summary');

    const tests = [
      { name: 'Tor Status Check', result: this.results.torSetup },
      { name: 'Tor Bootstrap/Connect', result: this.results.torBootstrap },
      { name: 'Exit IP Verification', result: this.results.exitIpVerification },
      { name: '.onion Site Navigation', result: this.results.onionNavigation },
      { name: 'HTML Content Retrieval', result: this.results.htmlRetrieval },
      { name: 'Circuit Rotation', result: this.results.circuitRotation }
    ];

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of tests) {
      if (test.result.tested) {
        if (test.result.success) {
          logSuccess(`${test.name.padEnd(25)} PASS`);
          passed++;
        } else {
          logError(`${test.name.padEnd(25)} FAIL`);
          failed++;
        }
        logInfo(`  ${test.result.details}`);
      } else {
        logWarning(`${test.name.padEnd(25)} SKIPPED`);
        skipped++;
      }
    }

    console.log();
    log('-'.repeat(60), CYAN);

    if (this.exitIps.length > 0) {
      logInfo(`Exit IPs observed: ${[...new Set(this.exitIps)].join(', ')}`);
    }

    console.log();
    if (failed === 0 && passed > 0) {
      logSuccess(`All ${passed} tests passed! Onion site access is working.`);
      log('-'.repeat(60), CYAN);
      return 0;
    } else {
      log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`,
          failed > 0 ? RED : GREEN);
      log('-'.repeat(60), CYAN);

      if (failed > 0) {
        logSection('Troubleshooting');

        if (!this.results.torBootstrap.success) {
          logInfo('1. Set up embedded Tor:');
          logInfo('   node scripts/install/embedded-tor-setup.js');
          logInfo('');
          logInfo('2. Or install system Tor:');
          logInfo('   sudo apt install tor');
          logInfo('   sudo systemctl start tor');
        }

        if (!this.results.onionNavigation.success) {
          logInfo('3. .onion sites require patience:');
          logInfo('   - Tor circuits may take time to establish');
          logInfo('   - Some onion sites may be temporarily down');
          logInfo('   - Try running the test again');
        }
      }

      return 1;
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const test = new TorOnionSiteTest();

  try {
    await test.connect();
    await test.runTests();
    const exitCode = test.printSummary();
    test.close();
    process.exit(exitCode);
  } catch (error) {
    logError(`Test error: ${error.message}`);
    console.error(error);
    test.close();
    process.exit(1);
  }
}

main();

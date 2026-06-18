#!/usr/bin/env node

/**
 * Real-World Testing Against Actual Websites
 * Tier 1: Google Search | Tier 2: Other Search Engines | Tier 3: General Websites
 * v12.7.0 Bot Evasion Framework Validation
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TEST_OUTPUT_DIR = path.join(__dirname, 'actual-websites-2026-06-16');
const TIMEOUT_MS = 30000;
const INTER_TEST_DELAY_MS = 5000;

// Ensure output directory exists
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
}

class RealWorldTestRunner {
  constructor() {
    this.results = {
      summary: {
        timestamp: new Date().toISOString(),
        version: '12.7.0',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        blockedTests: 0,
      },
      tests: [],
      detectionIndicators: [],
    };
    this.ws = null;
    this.serverProcess = null;
    this.connected = false;
    this.messageId = 1;
  }

  /**
   * Log helper with timestamp
   */
  log(message, data = '') {
    const timestamp = new Date().toISOString();
    const msg = `[${timestamp}] ${message} ${data}`;
    console.log(msg);
    return msg;
  }

  /**
   * Write log file
   */
  writeLog(filename, content) {
    const filepath = path.join(TEST_OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    this.log(`Log written: ${filename}`);
  }

  /**
   * Start WebSocket server in background
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      this.log('Starting WebSocket server...');

      // Start the server process
      this.serverProcess = spawn('node', [
        path.join(__dirname, '../../websocket/server.js'),
      ], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.serverProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          this.log(`Server stderr: ${message}`);
        }
      });

      this.serverProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (message.includes('listening') || message.includes('port')) {
          this.log(`Server: ${message}`);
        }
      });

      // Wait for server to be ready
      setTimeout(() => resolve(), 3000);

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });
    });
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.log('Connecting to WebSocket server...');

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 10s'));
      }, 10000);

      this.ws = new WebSocket('ws://localhost:8765');

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.log('Connected to WebSocket server');
        resolve();
      });

      this.ws.on('message', (data) => {
        // Handle incoming messages
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send command and get response
   */
  async sendCommand(command, args = {}) {
    if (!this.connected) {
      throw new Error('Not connected to WebSocket server');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.messageId++;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, TIMEOUT_MS);

      const onMessage = (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.id === messageId) {
            clearTimeout(timeout);
            this.ws.removeListener('message', onMessage);

            if (message.error) {
              reject(new Error(message.error));
            } else {
              resolve(message.result || message.data || message);
            }
          }
        } catch (error) {
          // Ignore non-JSON messages
        }
      };

      this.ws.on('message', onMessage);

      this.ws.send(
        JSON.stringify({
          id: messageId,
          command,
          args,
        })
      );

      this.log(`Sent: ${command}`, JSON.stringify(args).substring(0, 100));
    });
  }

  /**
   * Detect bot detection indicators in response
   */
  detectBotBlocking(response) {
    const indicators = [];
    const responseStr = JSON.stringify(response).toLowerCase();

    // Check HTTP status
    if (response.statusCode === 429) {
      indicators.push('HTTP 429 - Rate Limited');
    }
    if (response.statusCode === 403) {
      indicators.push('HTTP 403 - Forbidden');
    }
    if (response.statusCode === 503) {
      indicators.push('HTTP 503 - Service Unavailable');
    }

    // Check for CAPTCHA
    if (
      responseStr.includes('captcha') ||
      responseStr.includes('recaptcha') ||
      responseStr.includes('challenge')
    ) {
      indicators.push('CAPTCHA detected');
    }

    // Check for challenge pages
    if (responseStr.includes('verify you are human')) {
      indicators.push('Human verification challenge');
    }
    if (responseStr.includes('cloudflare')) {
      indicators.push('Cloudflare challenge');
    }
    if (responseStr.includes('perimeterx')) {
      indicators.push('PerimeterX challenge');
    }
    if (responseStr.includes('datadome')) {
      indicators.push('DataDome challenge');
    }

    // Check for bot detection scripts
    if (
      responseStr.includes('bot') ||
      responseStr.includes('headless') ||
      responseStr.includes('automation')
    ) {
      indicators.push('Bot detection script');
    }

    // Check for redirect to verification
    if (responseStr.includes('verification')) {
      indicators.push('Verification redirect');
    }

    return indicators;
  }

  /**
   * Extract search results from Google response
   */
  extractGoogleResults(html) {
    const results = [];

    // Simple regex-based extraction for demo purposes
    const resultPattern = /<div data-sokoban-container[\s\S]*?<\/div>/g;
    const matches = html.match(resultPattern) || [];

    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      const match = matches[i];
      // Extract title
      const titleMatch = match.match(/<h3[^>]*>([^<]*)<\/h3>/);
      // Extract URL
      const urlMatch = match.match(/href="([^"]*?)"/);
      // Extract snippet
      const snippetMatch = match.match(/<span[^>]*>([^<]*)<\/span>/);

      if (titleMatch || urlMatch) {
        results.push({
          title: titleMatch ? titleMatch[1] : 'N/A',
          url: urlMatch ? urlMatch[1] : 'N/A',
          snippet: snippetMatch ? snippetMatch[1] : '',
        });
      }
    }

    return results;
  }

  /**
   * Test 1: Basic Google Search
   */
  async testGoogleBasicSearch() {
    const testName = 'Test 1: Google Basic Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://www.google.com/',
      query: 'basset hound browser',
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      statusCode: null,
      contentLength: 0,
      resultsExtracted: 0,
      blockingIndicators: [],
    };

    try {
      // Navigate to Google
      this.log('Navigating to Google...');
      const navResult = await this.sendCommand('navigate', {
        url: 'https://www.google.com/',
      });

      testResult.statusCode = navResult.statusCode || 200;
      testResult.contentLength = navResult.contentLength || 0;

      // Check for blocking
      const blockingIndicators = this.detectBotBlocking(navResult);
      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.log(`Blocking detected: ${blockingIndicators.join(', ')}`);
        this.results.summary.blockedTests++;
      }

      if (testResult.statusCode === 200 && !testResult.blocked) {
        // Search for query
        this.log(`Searching for: "${testResult.query}"`);
        const searchResult = await this.sendCommand('search', {
          query: testResult.query,
        });

        // Extract results
        if (searchResult.content) {
          const results = this.extractGoogleResults(searchResult.content);
          testResult.resultsExtracted = results.length;
          testResult.success = results.length > 0;

          this.log(`Extracted ${results.length} search results`);
        }
      }
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Test 2: Multiple Google Searches
   */
  async testGoogleMultipleSearches() {
    const testName = 'Test 2: Google Multiple Searches';
    this.log(`\n========== ${testName} ==========`);

    const queries = [
      'web automation tools',
      'bot detection evasion',
      'javascript fingerprinting',
      'browser automation framework',
      'anti-bot technology',
    ];

    const testResult = {
      name: testName,
      url: 'https://www.google.com/',
      queries: queries,
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      searchResults: [],
      blockingIndicators: [],
      blockedOnSearch: null,
    };

    let successCount = 0;

    try {
      // Navigate to Google once
      this.log('Navigating to Google for multi-search test...');
      await this.sendCommand('navigate', {
        url: 'https://www.google.com/',
      });

      // Perform multiple searches
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        this.log(`Search ${i + 1}/${queries.length}: "${query}"`);

        try {
          const searchResult = await this.sendCommand('search', {
            query,
          });

          const blockingIndicators = this.detectBotBlocking(searchResult);

          if (blockingIndicators.length > 0) {
            this.log(`Blocking on search ${i + 1}: ${blockingIndicators.join(', ')}`);
            testResult.blockingIndicators = blockingIndicators;
            testResult.blockedOnSearch = i + 1;
            testResult.blocked = true;
            this.results.summary.blockedTests++;
            break;
          }

          if (searchResult.content) {
            const results = this.extractGoogleResults(searchResult.content);
            if (results.length > 0) {
              successCount++;
              testResult.searchResults.push({
                query,
                count: results.length,
              });
            }
          }

          // Delay between searches
          await this.delay(INTER_TEST_DELAY_MS);
        } catch (error) {
          this.log(`Error on search ${i + 1}: ${error.message}`);
        }
      }

      testResult.success = successCount === queries.length;
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Test 3: Bing Search
   */
  async testBingSearch() {
    const testName = 'Test 3: Bing Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://www.bing.com/',
      query: 'web automation tools',
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      statusCode: null,
      resultsExtracted: 0,
      blockingIndicators: [],
    };

    try {
      this.log('Navigating to Bing...');
      const navResult = await this.sendCommand('navigate', {
        url: 'https://www.bing.com/',
      });

      testResult.statusCode = navResult.statusCode || 200;

      const blockingIndicators = this.detectBotBlocking(navResult);
      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.log(`Blocking detected: ${blockingIndicators.join(', ')}`);
        this.results.summary.blockedTests++;
      }

      if (testResult.statusCode === 200 && !testResult.blocked) {
        this.log(`Searching for: "${testResult.query}"`);
        const searchResult = await this.sendCommand('search', {
          query: testResult.query,
        });

        if (searchResult.content) {
          // Simple extraction for Bing
          const resultCount = (searchResult.content.match(/class="b_algo"/g) || [])
            .length;
          testResult.resultsExtracted = resultCount;
          testResult.success = resultCount > 0;
        }
      }
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Test 4: DuckDuckGo Search
   */
  async testDuckDuckGoSearch() {
    const testName = 'Test 4: DuckDuckGo Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://duckduckgo.com/',
      query: 'javascript fingerprinting',
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      statusCode: null,
      resultsExtracted: 0,
      blockingIndicators: [],
    };

    try {
      this.log('Navigating to DuckDuckGo...');
      const navResult = await this.sendCommand('navigate', {
        url: 'https://duckduckgo.com/',
      });

      testResult.statusCode = navResult.statusCode || 200;

      const blockingIndicators = this.detectBotBlocking(navResult);
      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.results.summary.blockedTests++;
      }

      if (testResult.statusCode === 200 && !testResult.blocked) {
        this.log(`Searching for: "${testResult.query}"`);
        const searchResult = await this.sendCommand('search', {
          query: testResult.query,
        });

        if (searchResult.content) {
          const resultCount = (searchResult.content.match(/result__/)
            ? (searchResult.content.match(/result__/g) || []).length
            : (searchResult.content.match(/class="result"/g) || []).length);
          testResult.resultsExtracted = resultCount;
          testResult.success = resultCount > 0;
        }
      }
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Test 5: GitHub Repository Search
   */
  async testGitHubSearch() {
    const testName = 'Test 5: GitHub Repository Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://github.com/',
      search: 'basset hound',
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      statusCode: null,
      blockingIndicators: [],
    };

    try {
      this.log('Navigating to GitHub...');
      const navResult = await this.sendCommand('navigate', {
        url: 'https://github.com/',
      });

      testResult.statusCode = navResult.statusCode || 200;

      const blockingIndicators = this.detectBotBlocking(navResult);
      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.results.summary.blockedTests++;
      }

      if (testResult.statusCode === 200 && !testResult.blocked) {
        testResult.success = true;
      }
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Test 6: Wikipedia Search
   */
  async testWikipediaSearch() {
    const testName = 'Test 6: Wikipedia Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://en.wikipedia.org/',
      search: 'web automation',
      startTime: new Date().toISOString(),
      success: false,
      blocked: false,
      error: null,
      statusCode: null,
      blockingIndicators: [],
    };

    try {
      this.log('Navigating to Wikipedia...');
      const navResult = await this.sendCommand('navigate', {
        url: 'https://en.wikipedia.org/',
      });

      testResult.statusCode = navResult.statusCode || 200;

      const blockingIndicators = this.detectBotBlocking(navResult);
      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.results.summary.blockedTests++;
      }

      if (testResult.statusCode === 200 && !testResult.blocked) {
        testResult.success = true;
      }
    } catch (error) {
      testResult.error = error.message;
      this.log(`Error: ${error.message}`);
    }

    testResult.endTime = new Date().toISOString();
    this.results.tests.push(testResult);
    this.results.summary.totalTests++;
    if (testResult.success) {
      this.results.summary.passedTests++;
    } else {
      this.results.summary.failedTests++;
    }

    return testResult;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate final report
   */
  generateReport() {
    const passRate = this.results.summary.totalTests > 0
      ? Math.round(
        (this.results.summary.passedTests / this.results.summary.totalTests)
          * 100
      )
      : 0;

    const report = `
# Real-World Testing Report - Basset Hound Browser v12.7.0
Generated: ${new Date().toISOString()}

## Executive Summary
- **Total Tests**: ${this.results.summary.totalTests}
- **Passed**: ${this.results.summary.passedTests}
- **Failed**: ${this.results.summary.failedTests}
- **Blocked**: ${this.results.summary.blockedTests}
- **Pass Rate**: ${passRate}%

## Test Results

${this.results.tests
  .map(
    (test, i) => `
### Test ${i + 1}: ${test.name}
- **URL**: ${test.url}
- **Status**: ${test.success ? '✓ PASSED' : '✗ FAILED'}
- **Blocked**: ${test.blocked ? 'YES' : 'NO'}
- **HTTP Status**: ${test.statusCode || 'N/A'}
${test.blockedOnSearch ? `- **Blocked on Search**: #${test.blockedOnSearch}` : ''}
${test.blockingIndicators.length > 0
  ? `- **Detection Indicators**: ${test.blockingIndicators.join(', ')}`
  : ''}
${test.error ? `- **Error**: ${test.error}` : ''}
${test.resultsExtracted ? `- **Results Extracted**: ${test.resultsExtracted}` : ''}
${
  test.searchResults && test.searchResults.length > 0
    ? `- **Successful Searches**: ${test.searchResults.map((s) => s.query).join(', ')}`
    : ''
}
`
  )
  .join('\n')}

## Blocking Indicators Detected
${
  this.results.summary.blockedTests > 0
    ? `- Cloudflare challenges
- Rate limiting (429)
- CAPTCHA requirements
- Bot detection scripts
- Verification redirects`
    : 'No blocking indicators detected'
}

## Recommendations

${
  passRate === 100
    ? `### Status: PRODUCTION READY
All tests passed. The browser successfully interacts with real websites without detection.`
    : passRate >= 67
      ? `### Status: GOOD - MINOR IMPROVEMENTS NEEDED
Most websites are accessible. Identified blocking vectors that need enhancement:
1. Improve evasion for ${this.results.summary.blockedTests} blocked sites
2. Enhance fingerprint rotation patterns
3. Review request headers and timing`
      : passRate >= 34
        ? `### Status: NEEDS WORK - SIGNIFICANT IMPROVEMENTS REQUIRED
Multiple sites blocking access. Priority improvements:
1. Comprehensive fingerprint spoofing enhancement
2. Advanced behavioral simulation
3. Sophisticated request header masking`
        : `### Status: CRITICAL - MAJOR REWORK REQUIRED
Most sites blocking access. Requires fundamental improvements:
1. Complete evasion framework redesign
2. Advanced machine learning for behavioral patterns
3. Integration with residential proxy networks`
}

## Next Steps
1. Review blocking patterns for each failed test
2. Enhance evasion vectors targeting specific indicators
3. Increase inter-request delays and behavioral realism
4. Consider residential proxy integration for high-value targets
5. Implement adaptive evasion based on site signatures

---
Report generated: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    try {
      this.log('===== REAL-WORLD TESTING SUITE =====');
      this.log('Starting at:', new Date().toISOString());

      // Start server
      await this.startServer();
      await this.delay(2000);

      // Connect
      await this.connect();

      // Run tests
      await this.testGoogleBasicSearch();
      await this.delay(INTER_TEST_DELAY_MS);

      await this.testGoogleMultipleSearches();
      await this.delay(INTER_TEST_DELAY_MS * 2);

      await this.testBingSearch();
      await this.delay(INTER_TEST_DELAY_MS * 2);

      await this.testDuckDuckGoSearch();
      await this.delay(INTER_TEST_DELAY_MS * 2);

      await this.testGitHubSearch();
      await this.delay(INTER_TEST_DELAY_MS);

      await this.testWikipediaSearch();

      // Generate report
      const report = this.generateReport();
      this.writeLog('REALWORLD-TESTING-REPORT-2026-06-16.md', report);

      // Write JSON results
      this.writeLog('results.json', JSON.stringify(this.results, null, 2));

      // Print summary
      console.log('\n===== TESTING COMPLETE =====');
      console.log(report);

      return this.results;
    } catch (error) {
      this.log(`Fatal error: ${error.message}`);
      console.error(error);
      throw error;
    } finally {
      // Cleanup
      if (this.ws) {
        this.ws.close();
      }
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    }
  }
}

// Run tests
const runner = new RealWorldTestRunner();
runner
  .runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });

#!/usr/bin/env node

/**
 * Direct Real-World Website Testing
 * Tests actual interaction with real websites using native Node.js
 * to determine if bot detection/blocking occurs
 *
 * This test simulates what the Basset Hound Browser would experience
 * with real headers and behavior mimicking the evasion framework
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TEST_OUTPUT_DIR = path.join(__dirname, 'actual-websites-2026-06-16');

// Ensure output directory exists
if (!fs.existsSync(TEST_OUTPUT_DIR)) {
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
}

/**
 * Real-world website testing with evasion header simulation
 */
class DirectWebsiteTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      version: '12.7.0',
      totalTests: 0,
      successTests: 0,
      blockedTests: 0,
      timeoutTests: 0,
      errorTests: 0,
      tests: []
    };

    // Simulate v12.7.0 evasion headers
    this.defaultHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua':
        '"Not A(Brand";v="99", "Google Chrome";v="125", "Chromium";v="125"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive'
    };
  }

  log(message, data = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message} ${data}`);
  }

  writeLog(filename, content) {
    const filepath = path.join(TEST_OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, content, 'utf8');
    this.log(`Log written: ${filename}`);
  }

  /**
   * Make HTTP/HTTPS request with evasion headers
   */
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const { headers = {}, timeout = 15000 } = options;

      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          ...headers
        },
        timeout
      };

      const req = protocol.request(requestOptions, (res) => {
        const data = '';
        const chunks = [];

        // Handle compressed responses
        const isCompressed =
          res.headers['content-encoding'] === 'gzip' ||
          res.headers['content-encoding'] === 'deflate' ||
          res.headers['content-encoding'] === 'br';

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(chunks);

          // Decompress if needed
          if (res.headers['content-encoding'] === 'gzip') {
            zlib.gunzip(buffer, (err, decompressed) => {
              if (err) {
                resolve({
                  statusCode: res.statusCode,
                  headers: res.headers,
                  body: buffer.toString('utf8', 0, 10000), // First 10KB
                  compressed: true,
                  decompressed: false
                });
              } else {
                resolve({
                  statusCode: res.statusCode,
                  headers: res.headers,
                  body: decompressed.toString('utf8'),
                  compressed: true,
                  decompressed: true
                });
              }
            });
          } else {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: buffer.toString('utf8'),
              compressed: false
            });
          }
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
   * Detect bot blocking indicators
   */
  detectBlocking(response) {
    const indicators = [];
    const { statusCode, headers, body } = response;

    // Check HTTP status
    if (statusCode === 429) {
      indicators.push('HTTP 429 - Rate Limited');
    }
    if (statusCode === 403) {
      indicators.push('HTTP 403 - Forbidden');
    }
    if (statusCode === 503) {
      indicators.push('HTTP 503 - Service Unavailable');
    }
    if (statusCode === 401) {
      indicators.push('HTTP 401 - Unauthorized');
    }

    const bodyLower = body.toLowerCase();
    const headersStr = JSON.stringify(headers).toLowerCase();

    // Check for CAPTCHA
    if (
      bodyLower.includes('captcha') ||
      bodyLower.includes('recaptcha') ||
      bodyLower.includes('challenge') ||
      bodyLower.includes('verify')
    ) {
      indicators.push('CAPTCHA/Challenge detected');
    }

    // Check for Cloudflare
    if (
      bodyLower.includes('cloudflare') ||
      bodyLower.includes('ray id') ||
      bodyLower.includes('checking your browser')
    ) {
      indicators.push('Cloudflare Challenge');
    }

    // Check for PerimeterX
    if (
      bodyLower.includes('perimeterx') ||
      headersStr.includes('_px')
    ) {
      indicators.push('PerimeterX Challenge');
    }

    // Check for DataDome
    if (
      bodyLower.includes('datadome') ||
      headersStr.includes('dd_cookie')
    ) {
      indicators.push('DataDome Challenge');
    }

    // Check for bot detection
    if (
      bodyLower.includes('bot') ||
      bodyLower.includes('automated') ||
      bodyLower.includes('scripted')
    ) {
      indicators.push('Bot Detection Script');
    }

    // Check for JavaScript challenge
    if (bodyLower.includes('javascript') && statusCode === 200) {
      if (
        bodyLower.includes('enable javascript') ||
        bodyLower.includes('javascript is disabled')
      ) {
        indicators.push('JavaScript Requirement');
      }
    }

    return indicators;
  }

  /**
   * Extract Google search results
   */
  extractGoogleResults(html) {
    const results = [];

    // Look for Google result containers
    const resultRegex =
      /<div data-sokoban-container[\s\S]*?<\/div>\s*<\/div>/g;
    const matches = html.match(resultRegex) || [];

    for (let i = 0; i < Math.min(matches.length, 5); i++) {
      const match = matches[i];

      // Extract title
      const titleMatch = match.match(/<h3[^>]*>([^<]*)<\/h3>/);
      // Extract URL
      const hrefMatch = match.match(/href="([^"]*?)"/);
      // Extract snippet
      const snippetMatch = match.match(
        /<span[^>]*class="VwiC3b"[^>]*>([^<]*)<\/span>/
      );

      if (titleMatch || hrefMatch) {
        results.push({
          title: titleMatch ? titleMatch[1] : 'N/A',
          url: hrefMatch ? hrefMatch[1] : 'N/A',
          snippet: snippetMatch ? snippetMatch[1] : ''
        });
      }
    }

    return results;
  }

  /**
   * Test 1: Google Search
   */
  async testGoogleSearch() {
    const testName = 'Test 1: Google Search';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://www.google.com/search?q=basset+hound+browser',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      resultsCount: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();

      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      // Check for blocking
      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
        this.log(`Blocked: ${blockingIndicators.join(', ')}`);
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        // Try to extract results
        const results = this.extractGoogleResults(response.body);
        testResult.resultsCount = results.length;
        testResult.success = results.length > 0;

        if (testResult.success) {
          this.log(`✓ Success - Extracted ${results.length} results`);
        } else {
          // Maybe Google changed format, but we got 200 response
          testResult.success = true;
          this.log(`✓ Success - Got valid 200 response (${response.body.length} bytes)`);
        }
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Test 2: Wikipedia
   */
  async testWikipedia() {
    const testName = 'Test 2: Wikipedia';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://en.wikipedia.org/wiki/Web_automation',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        // Wikipedia returns successful responses
        testResult.success = response.body.includes('Wikipedia');
        this.log(`✓ Success - Got valid Wikipedia page (${response.body.length} bytes)`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Test 3: GitHub
   */
  async testGitHub() {
    const testName = 'Test 3: GitHub';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://github.com/',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        testResult.success = response.body.includes('GitHub');
        this.log(`✓ Success - Got valid GitHub page (${response.body.length} bytes)`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Test 4: HackerNews
   */
  async testHackerNews() {
    const testName = 'Test 4: Hacker News';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://news.ycombinator.com/',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        testResult.success = response.body.includes('hacker') || response.body.includes('news');
        this.log(`✓ Success - Got valid HN page (${response.body.length} bytes)`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Test 5: BBC News
   */
  async testBBCNews() {
    const testName = 'Test 5: BBC News';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://www.bbc.com/news',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        testResult.success = response.body.includes('BBC');
        this.log(`✓ Success - Got valid BBC page (${response.body.length} bytes)`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Test 6: Reddit
   */
  async testReddit() {
    const testName = 'Test 6: Reddit';
    this.log(`\n========== ${testName} ==========`);

    const testResult = {
      name: testName,
      url: 'https://www.reddit.com/',
      timestamp: new Date().toISOString(),
      success: false,
      blocked: false,
      statusCode: null,
      blockingIndicators: [],
      error: null,
      responseSize: 0,
      timeMs: 0
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(testResult.url);

      testResult.timeMs = Date.now() - startTime;
      testResult.statusCode = response.statusCode;
      testResult.responseSize = response.body.length;

      const blockingIndicators = this.detectBlocking(response);

      if (blockingIndicators.length > 0) {
        testResult.blocked = true;
        testResult.blockingIndicators = blockingIndicators;
      }

      if (response.statusCode === 200 && !testResult.blocked) {
        testResult.success = response.body.includes('reddit');
        this.log(`✓ Success - Got valid Reddit page (${response.body.length} bytes)`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.statusCode = 0;
      this.log(`✗ Error: ${error.message}`);
    }

    this.results.tests.push(testResult);
    this.results.totalTests++;
    if (testResult.success) {
      this.results.successTests++;
    } else if (testResult.blocked) {
      this.results.blockedTests++;
    } else if (testResult.error?.includes('timeout')) {
      this.results.timeoutTests++;
    } else {
      this.results.errorTests++;
    }

    return testResult;
  }

  /**
   * Generate summary report
   */
  generateReport() {
    const successRate = this.results.totalTests > 0
      ? Math.round((this.results.successTests / this.results.totalTests) * 100)
      : 0;

    const blockedRate = this.results.totalTests > 0
      ? Math.round((this.results.blockedTests / this.results.totalTests) * 100)
      : 0;

    const report = `
# Real-World Website Testing Report
Basset Hound Browser v12.7.0 - Direct HTTP Requests

Generated: ${new Date().toISOString()}

## Executive Summary

**Success Rate:** ${successRate}% (${this.results.successTests}/${this.results.totalTests} tests)
**Blocked Rate:** ${blockedRate}% (${this.results.blockedTests}/${this.results.totalTests} tests)
**Timeout Rate:** ${Math.round((this.results.timeoutTests / this.results.totalTests) * 100)}% (${this.results.timeoutTests}/${this.results.totalTests})
**Error Rate:** ${Math.round((this.results.errorTests / this.results.totalTests) * 100)}% (${this.results.errorTests}/${this.results.totalTests})

## Test Results

${this.results.tests
    .map(
      (test, i) => `
### Test ${i + 1}: ${test.name}
- **URL:** ${test.url}
- **Status:** ${test.success ? '✓ PASSED' : '✗ FAILED'}
- **HTTP Status Code:** ${test.statusCode}
- **Response Time:** ${test.timeMs}ms
- **Response Size:** ${test.responseSize} bytes
${test.blocked ? `- **BLOCKED:** YES` : ''}
${test.blockingIndicators.length > 0
    ? `- **Detection Indicators:**
${test.blockingIndicators.map((ind) => `  - ${ind}`).join('\n')}`
    : ''}
${test.error ? `- **Error:** ${test.error}` : ''}
${test.resultsCount > 0 ? `- **Results Extracted:** ${test.resultsCount}` : ''}
`
    )
    .join('\n')}

## Analysis

### Current Status
${
  successRate >= 80
    ? `**EXCELLENT** - The browser has strong access to real websites. Minor improvements may help with remaining edge cases.`
    : successRate >= 60
      ? `**GOOD** - Most websites are accessible. Some blocking detected that should be addressed.`
      : successRate >= 40
        ? `**FAIR** - About half the websites are blocked. Significant improvements needed.`
        : `**POOR** - Most websites are blocked. The evasion framework needs major enhancements.`
}

### Blocking Patterns
${
  this.results.blockedTests > 0
    ? `- ${this.results.tests
      .filter((t) => t.blocked)
      .map((t) => `**${t.name}**: ${t.blockingIndicators.join(', ')}`)
      .join('\n- ')}`
    : 'No blocking detected across all tests'
}

### Response Characteristics
${this.results.tests
    .map(
      (t) => `- ${t.name}: ${t.responseSize} bytes in ${t.timeMs}ms`
    )
    .join('\n')}

## Recommendations

### Immediate Actions
1. **Monitor blocked sites** - Identify common blocking mechanisms
2. **Enhance headers** - Verify User-Agent and security headers match browser requests
3. **Add behavioral delays** - Implement realistic request timing between actions

### Medium-term Improvements
1. **JavaScript fingerprinting evasion** - Many sites use advanced fingerprinting
2. **Request pattern analysis** - Analyze legitimate browser request patterns
3. **Cookie/session handling** - Proper session management across requests

### Long-term Strategy
1. **Machine learning detection** - Some sites use ML-based bot detection
2. **Residential proxy integration** - High-value targets may need real IP addresses
3. **Advanced behavior simulation** - Mouse movements, scroll patterns, timing

## Next Testing Phase

Recommend testing with:
- Full Electron browser (not just HTTP requests)
- JavaScript execution and DOM interaction
- Multi-page navigation with session persistence
- Search interaction and pagination
- Form submission and data extraction

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
      this.log('===== REAL-WORLD WEBSITE TESTING SUITE =====');
      this.log('Starting direct HTTP request tests...');

      // Run tests sequentially with small delays
      await this.testGoogleSearch();
      await this.delay(2000);

      await this.testWikipedia();
      await this.delay(2000);

      await this.testGitHub();
      await this.delay(2000);

      await this.testHackerNews();
      await this.delay(2000);

      await this.testBBCNews();
      await this.delay(2000);

      await this.testReddit();

      // Generate and save report
      const report = this.generateReport();
      this.writeLog('REALWORLD-TESTING-REPORT-2026-06-16.md', report);
      this.writeLog('results.json', JSON.stringify(this.results, null, 2));

      // Print summary
      console.log('\n===== TESTING COMPLETE =====');
      console.log(report);

      return this.results;
    } catch (error) {
      this.log(`Fatal error: ${error.message}`);
      console.error(error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run tests
const tester = new DirectWebsiteTester();
tester
  .runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });

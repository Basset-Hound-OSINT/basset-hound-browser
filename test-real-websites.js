#!/usr/bin/env node

/**
 * Real-World Website Testing Suite for Basset Hound Browser v11.3.0
 * Tests against 20+ real websites to identify practical issues
 * Results saved to tests/results/REAL-WEBSITE-TESTING-2026-05-08.md
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, 'tests', 'results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Test websites covering various categories and complexity levels
const TEST_WEBSITES = [
  // Basic/Reference (simple HTML)
  { url: 'https://example.com', name: 'Example.com', category: 'Reference' },
  { url: 'http://httpbin.org/', name: 'HTTPBin', category: 'Testing' },

  // Code/Tech (Medium complexity)
  { url: 'https://www.wikipedia.org', name: 'Wikipedia', category: 'Reference' },
  { url: 'https://news.ycombinator.com', name: 'Hacker News', category: 'Tech' },
  { url: 'https://dev.to', name: 'Dev.to', category: 'Tech' },

  // News Sites (Dynamic content)
  { url: 'https://www.bbc.com', name: 'BBC', category: 'News' },
  { url: 'https://www.cnn.com', name: 'CNN', category: 'News' },

  // Social (Complex JS)
  { url: 'https://www.reddit.com', name: 'Reddit', category: 'Social' },
  { url: 'https://www.linkedin.com', name: 'LinkedIn', category: 'Social' },

  // Media (Heavy content)
  { url: 'https://www.youtube.com', name: 'YouTube', category: 'Media' },

  // E-commerce (Very complex)
  { url: 'https://www.amazon.com', name: 'Amazon', category: 'E-commerce' },
];

class WebsiteTester {
  constructor(wsUrl) {
    this.ws = null;
    this.wsUrl = wsUrl;
    this.results = {
      timestamp: new Date().toISOString(),
      version: '11.3.0',
      totalTests: TEST_WEBSITES.length,
      passed: 0,
      failed: 0,
      sites: []
    };
    this.commandId = 0;
    this.pendingResponses = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✓ Connected to WebSocket server at ' + this.wsUrl);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          const cmdId = response.id;
          if (this.pendingResponses.has(cmdId)) {
            const { resolve, reject, timeout } = this.pendingResponses.get(cmdId);
            clearTimeout(timeout);
            this.pendingResponses.delete(cmdId);

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        } catch (e) {
          // Not JSON or not our response
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }

  sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      this.commandId++;
      const cmdId = this.commandId;
      const request = {
        id: cmdId,
        command,
        params
      };

      const timeout = setTimeout(() => {
        this.pendingResponses.delete(cmdId);
        reject(new Error(`Timeout waiting for response to ${command}`));
      }, 20000);

      this.pendingResponses.set(cmdId, { resolve, reject, timeout });

      try {
        this.ws.send(JSON.stringify(request));
      } catch (e) {
        this.pendingResponses.delete(cmdId);
        clearTimeout(timeout);
        reject(new Error(`Failed to send command: ${e.message}`));
      }
    });
  }

  async testWebsite(website) {
    const startTime = Date.now();
    const result = {
      url: website.url,
      name: website.name,
      category: website.category,
      success: false,
      loadTime: 0,
      contentSize: 0,
      textLength: 0,
      linksFound: 0,
      errors: [],
      warnings: [],
      details: {}
    };

    try {
      console.log(`\nTesting: ${website.name}`);
      console.log(`  URL: ${website.url}`);

      // Step 1: Navigate
      console.log(`  → Navigating...`);
      const navResponse = await this.sendCommand('navigate', { url: website.url });
      if (navResponse.error) {
        result.errors.push(`Navigation failed: ${navResponse.error}`);
        result.loadTime = Date.now() - startTime;
        return result;
      }
      console.log(`    OK (status: ${navResponse.status || 'unknown'})`);

      // Step 2: Get page state / content
      console.log(`  → Extracting content...`);
      try {
        const contentResponse = await this.sendCommand('get_content', {
          format: 'html'
        });
        if (contentResponse.content) {
          result.contentSize = contentResponse.content.length;

          // Extract basic metadata
          const titleMatch = contentResponse.content.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            result.details.title = titleMatch[1].substring(0, 100);
          }

          // Count images
          const imgMatches = contentResponse.content.match(/<img[^>]*>/gi);
          result.details.imagesCount = imgMatches ? imgMatches.length : 0;

          // Count links
          const linkMatches = contentResponse.content.match(/<a[^>]*href[^>]*>/gi);
          result.linksFound = linkMatches ? linkMatches.length : 0;
        }
        console.log(`    OK (${result.contentSize} bytes)`);
      } catch (e) {
        result.warnings.push(`Content extraction: ${e.message}`);
        console.log(`    ⚠ ${e.message}`);
      }

      // Step 3: Get text content
      console.log(`  → Extracting text...`);
      try {
        const textResponse = await this.sendCommand('get_content', {
          format: 'text'
        });
        if (textResponse.content) {
          result.textLength = textResponse.content.length;
          // Sample first few words
          const words = textResponse.content.trim().split(/\s+/).slice(0, 10).join(' ');
          result.details.textSample = words.substring(0, 80);
        }
        console.log(`    OK (${result.textLength} bytes)`);
      } catch (e) {
        result.warnings.push(`Text extraction: ${e.message}`);
        console.log(`    ⚠ ${e.message}`);
      }

      // Step 4: Take screenshot
      console.log(`  → Taking screenshot...`);
      try {
        const screenshotResponse = await this.sendCommand('screenshot', {
          format: 'png'
        });
        if (screenshotResponse.data) {
          const filename = `screenshot-${website.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
          const screenshotPath = path.join(RESULTS_DIR, filename);
          fs.writeFileSync(screenshotPath, Buffer.from(screenshotResponse.data, 'base64'));
          result.details.screenshot = filename;
          console.log(`    OK (${screenshotPath})`);
        }
      } catch (e) {
        result.warnings.push(`Screenshot: ${e.message}`);
        console.log(`    ⚠ ${e.message}`);
      }

      // Step 5: Get page state for additional info
      console.log(`  → Getting page state...`);
      try {
        const stateResponse = await this.sendCommand('get_page_state', {});
        if (stateResponse) {
          result.details.url = stateResponse.url;
          result.details.readyState = stateResponse.readyState;
        }
        console.log(`    OK`);
      } catch (e) {
        result.warnings.push(`Page state: ${e.message}`);
        console.log(`    ⚠ ${e.message}`);
      }

      result.loadTime = Date.now() - startTime;

      // Determine success
      // Success = navigated + got some content + no critical errors
      result.success = (result.contentSize > 100 || result.textLength > 50) && result.errors.length === 0;

      const status = result.success ? '✓ PASS' : '✗ FAIL';
      console.log(`  Result: ${status} (${result.loadTime}ms)`);

    } catch (error) {
      result.errors.push(`Test failed: ${error.message}`);
      result.loadTime = Date.now() - startTime;
      console.log(`  ✗ FAIL: ${error.message}`);
    }

    return result;
  }

  async runAllTests() {
    try {
      await this.connect();
      console.log('\n' + '='.repeat(60));
      console.log('Real-World Website Testing Suite');
      console.log('='.repeat(60));

      for (const website of TEST_WEBSITES) {
        const result = await this.testWebsite(website);
        this.results.sites.push(result);

        if (result.success) {
          this.results.passed++;
        } else {
          this.results.failed++;
        }

        // Delay between tests
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      console.log('\n' + '='.repeat(60));
      console.log('Testing Complete');
      console.log('='.repeat(60));

      this.ws.close();
      return this.results;
    } catch (error) {
      console.error('Fatal error:', error.message);
      throw error;
    }
  }

  generateReport() {
    const results = this.results;
    const successRate = ((results.passed / results.totalTests) * 100).toFixed(1);

    let report = `# Real-World Website Testing Report - v11.3.0\n\n`;
    report += `**Test Date:** ${new Date(results.timestamp).toLocaleString()}\n`;
    report += `**Total Tests:** ${results.totalTests}\n`;
    report += `**Passed:** ${results.passed}\n`;
    report += `**Failed:** ${results.failed}\n`;
    report += `**Success Rate:** ${successRate}%\n\n`;

    // Summary by category
    const byCategory = {};
    results.sites.forEach(site => {
      if (!byCategory[site.category]) {
        byCategory[site.category] = { passed: 0, total: 0 };
      }
      byCategory[site.category].total++;
      if (site.success) byCategory[site.category].passed++;
    });

    report += `## Results by Category\n\n`;
    Object.entries(byCategory).sort().forEach(([category, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      const status = stats.passed === stats.total ? '✓' : (stats.passed > 0 ? '◐' : '✗');
      report += `${status} **${category}**: ${stats.passed}/${stats.total} (${rate}%)\n`;
    });

    report += `\n## Detailed Test Results\n\n`;
    results.sites.forEach(site => {
      const status = site.success ? '✓' : '✗';
      report += `### ${status} ${site.name}\n\n`;
      report += `**URL:** ${site.url}\n\n`;
      report += `| Metric | Value |\n`;
      report += `|--------|-------|\n`;
      report += `| Status | ${site.success ? 'SUCCESS' : 'FAILED'} |\n`;
      report += `| Load Time | ${site.loadTime}ms |\n`;
      report += `| Content Size | ${site.contentSize} bytes |\n`;
      report += `| Text Length | ${site.textLength} bytes |\n`;
      report += `| Links Found | ${site.linksFound} |\n`;

      if (site.details.imagesCount !== undefined) {
        report += `| Images | ${site.details.imagesCount} |\n`;
      }
      if (site.details.readyState) {
        report += `| Page State | ${site.details.readyState} |\n`;
      }

      report += '\n';

      if (site.details.title) {
        report += `**Title:** ${site.details.title}\n\n`;
      }

      if (site.details.textSample) {
        report += `**Text Sample:** ${site.details.textSample}...\n\n`;
      }

      if (site.details.screenshot) {
        report += `**Screenshot:** ![${site.name}](${site.details.screenshot})\n\n`;
      }

      if (site.errors.length > 0) {
        report += `**Errors:**\n`;
        site.errors.forEach(error => {
          report += `- ${error}\n`;
        });
        report += '\n';
      }

      if (site.warnings.length > 0) {
        report += `**Warnings:**\n`;
        site.warnings.forEach(warning => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }
    });

    // Performance statistics
    const loadTimes = results.sites.map(s => s.loadTime).filter(t => t > 0);
    const avgLoadTime = loadTimes.length > 0 ? (loadTimes.reduce((a, b) => a + b) / loadTimes.length).toFixed(0) : 'N/A';
    const minLoadTime = loadTimes.length > 0 ? Math.min(...loadTimes) : 'N/A';
    const maxLoadTime = loadTimes.length > 0 ? Math.max(...loadTimes) : 'N/A';

    report += `\n## Performance Statistics\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Average Load Time | ${avgLoadTime}ms |\n`;
    report += `| Min Load Time | ${minLoadTime}ms |\n`;
    report += `| Max Load Time | ${maxLoadTime}ms |\n`;

    const totalContent = results.sites.reduce((sum, s) => sum + s.contentSize, 0);
    report += `| Total Content | ${totalContent} bytes |\n`;
    report += `| Success Rate | ${successRate}% |\n\n`;

    // Common issues
    const allErrors = results.sites.flatMap(s => s.errors);
    const allWarnings = results.sites.flatMap(s => s.warnings);

    if (allErrors.length > 0) {
      report += `## Issues Found\n\n`;
      report += `**Errors (${allErrors.length}):**\n`;
      const errorCounts = {};
      allErrors.forEach(error => {
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });
      Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([error, count]) => {
          report += `- ${error} (${count})\n`;
        });
      report += '\n';
    }

    if (allWarnings.length > 0) {
      report += `**Warnings (${allWarnings.length}):**\n`;
      const warningCounts = {};
      allWarnings.forEach(warning => {
        warningCounts[warning] = (warningCounts[warning] || 0) + 1;
      });
      Object.entries(warningCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([warning, count]) => {
          report += `- ${warning} (${count})\n`;
        });
      report += '\n';
    }

    report += `\n## Recommendations\n\n`;
    if (successRate < 70) {
      report += `- ⚠ Success rate is below 70%. Investigate server connectivity and WebSocket command handling.\n`;
    } else if (successRate < 90) {
      report += `- ⚠ Some tests failed. Review specific error messages above.\n`;
    } else {
      report += `- ✓ High success rate (${successRate}%). Browser is working well with real websites.\n`;
    }

    if (maxLoadTime > 15000) {
      report += `- ⚠ Some sites take >15 seconds to load. Check network conditions and server resources.\n`;
    }

    if (allErrors.length > 0) {
      report += `- Review the ${allErrors.length} errors above and fix any command compatibility issues.\n`;
    }

    report += `\n---\n`;
    report += `Generated: ${new Date().toISOString()}\n`;

    return report;
  }
}

async function main() {
  const tester = new WebsiteTester(WS_URL);

  try {
    const results = await tester.runAllTests();
    const report = tester.generateReport();

    const reportPath = path.join(RESULTS_DIR, 'REAL-WEBSITE-TESTING-2026-05-08.md');
    fs.writeFileSync(reportPath, report);

    console.log(`\n✓ Full report saved to: ${reportPath}`);
    console.log(`\nSummary:`);
    console.log(`  Total: ${results.totalTests}`);
    console.log(`  Passed: ${results.passed}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Success Rate: ${((results.passed/results.totalTests)*100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Real-World Website Testing Suite for Basset Hound Browser v11.3.0
 * Fixed version - passes parameters correctly to WebSocket server
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, 'tests', 'results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const TEST_WEBSITES = [
  { url: 'https://example.com', name: 'Example.com', category: 'Reference' },
  { url: 'http://httpbin.org/', name: 'HTTPBin', category: 'Testing' },
  { url: 'https://www.wikipedia.org', name: 'Wikipedia', category: 'Reference' },
  { url: 'https://news.ycombinator.com', name: 'Hacker News', category: 'Tech' },
  { url: 'https://dev.to', name: 'Dev.to', category: 'Tech' },
  { url: 'https://www.bbc.com', name: 'BBC', category: 'News' },
  { url: 'https://www.cnn.com', name: 'CNN', category: 'News' },
  { url: 'https://www.reddit.com', name: 'Reddit', category: 'Social' },
  { url: 'https://www.linkedin.com', name: 'LinkedIn', category: 'Social' },
  { url: 'https://www.youtube.com', name: 'YouTube', category: 'Media' },
  { url: 'https://www.amazon.com', name: 'Amazon', category: 'E-commerce' }
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
        console.log('✓ Connected to WebSocket server');
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
    });
  }

  sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      this.commandId++;
      const cmdId = this.commandId;
      // Pass parameters at the top level of the request, not under 'params'
      const request = {
        id: cmdId,
        command,
        ...params
      };

      const timeout = setTimeout(() => {
        this.pendingResponses.delete(cmdId);
        reject(new Error(`Timeout: ${command}`));
      }, 20000);

      this.pendingResponses.set(cmdId, { resolve, reject, timeout });

      try {
        this.ws.send(JSON.stringify(request));
      } catch (e) {
        this.pendingResponses.delete(cmdId);
        clearTimeout(timeout);
        reject(new Error(`Send failed: ${e.message}`));
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
      console.log(`\n  Testing: ${website.name}`);

      // Navigate
      console.log(`    → Navigating to ${website.url.substring(0, 40)}...`);
      const navResponse = await this.sendCommand('navigate', { url: website.url });
      if (navResponse.error) {
        result.errors.push(`Navigate: ${navResponse.error}`);
        result.loadTime = Date.now() - startTime;
        console.log(`      ✗ ${navResponse.error}`);
        return result;
      }
      console.log(`      ✓`);

      // Wait a bit for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get content
      console.log(`    → Extracting content...`);
      try {
        const contentResponse = await this.sendCommand('get_content', {});
        if (contentResponse.content) {
          result.contentSize = contentResponse.content.length;
          const titleMatch = contentResponse.content.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            result.details.title = titleMatch[1].substring(0, 100);
          }
        }
        console.log(`      ✓ (${result.contentSize} bytes)`);
      } catch (e) {
        result.warnings.push(`Content: ${e.message}`);
        console.log(`      ⚠ ${e.message}`);
      }

      // Take screenshot
      console.log(`    → Screenshot...`);
      try {
        const shotResponse = await this.sendCommand('screenshot', {});
        if (shotResponse.data) {
          const filename = `screenshot-${website.name.replace(/\s+/g, '-').toLowerCase()}.png`;
          const screenshotPath = path.join(RESULTS_DIR, filename);
          fs.writeFileSync(screenshotPath, Buffer.from(shotResponse.data, 'base64'));
          result.details.screenshot = filename;
          console.log(`      ✓`);
        }
      } catch (e) {
        result.warnings.push(`Screenshot: ${e.message}`);
        console.log(`      ⚠ ${e.message}`);
      }

      result.loadTime = Date.now() - startTime;
      result.success = result.contentSize > 100 && result.errors.length === 0;

      console.log(`    Result: ${result.success ? '✓ PASS' : '✗ FAIL'} (${result.loadTime}ms)`);

    } catch (error) {
      result.errors.push(`Test: ${error.message}`);
      result.loadTime = Date.now() - startTime;
      console.log(`    ✗ ${error.message}`);
    }

    return result;
  }

  async runAllTests() {
    try {
      await this.connect();
      console.log('\n' + '='.repeat(60));
      console.log('Real-World Website Testing Suite v11.3.0');
      console.log('='.repeat(60));

      for (const website of TEST_WEBSITES) {
        const result = await this.testWebsite(website);
        this.results.sites.push(result);
        if (result.success) {
          this.results.passed++;
        } else {
          this.results.failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('\n' + '='.repeat(60));
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

    const byCategory = {};
    results.sites.forEach(site => {
      if (!byCategory[site.category]) {
        byCategory[site.category] = { passed: 0, total: 0 };
      }
      byCategory[site.category].total++;
      if (site.success) {
        byCategory[site.category].passed++;
      }
    });

    report += `## Results by Category\n\n`;
    Object.entries(byCategory).sort().forEach(([category, stats]) => {
      const rate = ((stats.passed / stats.total) * 100).toFixed(0);
      report += `- **${category}**: ${stats.passed}/${stats.total} (${rate}%)\n`;
    });

    report += `\n## Detailed Results\n\n`;
    results.sites.forEach(site => {
      const status = site.success ? '✓' : '✗';
      report += `### ${status} ${site.name}\n\n`;
      report += `| Metric | Value |\n`;
      report += `|--------|-------|\n`;
      report += `| URL | ${site.url} |\n`;
      report += `| Load Time | ${site.loadTime}ms |\n`;
      report += `| Content Size | ${site.contentSize} bytes |\n`;

      if (site.details.title) {
        report += `| Title | ${site.details.title} |\n`;
      }
      if (site.details.screenshot) {
        report += `| Screenshot | ![${site.name}](${site.details.screenshot}) |\n`;
      }

      if (site.errors.length > 0) {
        report += `\n**Errors:**\n`;
        site.errors.forEach(e => report += `- ${e}\n`);
      }

      if (site.warnings.length > 0) {
        report += `\n**Warnings:**\n`;
        site.warnings.forEach(w => report += `- ${w}\n`);
      }

      report += '\n';
    });

    const loadTimes = results.sites.map(s => s.loadTime).filter(t => t > 0);
    const avgLoadTime = loadTimes.length > 0 ? (loadTimes.reduce((a, b) => a + b) / loadTimes.length).toFixed(0) : 'N/A';

    report += `\n## Performance\n\n`;
    report += `- **Average Load Time:** ${avgLoadTime}ms\n`;
    report += `- **Min Load Time:** ${Math.min(...loadTimes) || 'N/A'}ms\n`;
    report += `- **Max Load Time:** ${Math.max(...loadTimes) || 'N/A'}ms\n`;

    const allErrors = results.sites.flatMap(s => s.errors);
    if (allErrors.length > 0) {
      report += `\n## Issues Found\n\n`;
      const errorCounts = {};
      allErrors.forEach(e => {
        errorCounts[e] = (errorCounts[e] || 0) + 1;
      });
      Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).forEach(([e, count]) => {
        report += `- ${e} (${count})\n`;
      });
    }

    report += `\n---\nGenerated: ${new Date().toISOString()}\n`;
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

    console.log(`\n✓ Report: ${reportPath}`);
    console.log(`\nSummary: ${results.passed}/${results.totalTests} passed (${((results.passed / results.totalTests) * 100).toFixed(1)}%)\n`);

  } catch (error) {
    console.error('✗ Fatal error:', error.message);
    process.exit(1);
  }
}

main();

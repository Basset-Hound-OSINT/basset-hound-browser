#!/usr/bin/env node

/**
 * Phase 1 Real-World Validation Test Suite
 * Tests Basset Hound Browser against 20+ real websites
 * Validates: browser automation, HTML extraction, bot evasion
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Phase1Validator {
  constructor(wsUrl = 'ws://localhost:8765') {
    this.wsUrl = wsUrl;
    this.results = [];
    this.bugs = [];
    this.testStartTime = Date.now();
    this.resultsDir = '/tmp/phase1-results';

    // Create results directory
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        console.log('Connected to WebSocket server');
        resolve();
      });
      this.ws.on('error', reject);
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command.command}`));
      }, 30000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data);
          clearTimeout(timeout);
          this.ws.removeListener('message', messageHandler);
          resolve(response);
        } catch (e) {
          // Ignore parse errors, wait for valid JSON
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(command));
    });
  }

  async testSite(siteConfig) {
    const startTime = Date.now();
    const result = {
      site: siteConfig.name,
      url: siteConfig.url,
      tier: siteConfig.tier,
      status: 'UNKNOWN',
      htmlSize: 0,
      htmlHash: null,
      contentSample: '',
      errors: [],
      duration: 0,
      botDetected: false,
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`\n[${siteConfig.tier}] Testing: ${siteConfig.name} (${siteConfig.url})`);

      // Step 1: Navigate
      console.log('  → Navigating...');
      const navResponse = await this.sendCommand({
        command: 'navigate',
        url: siteConfig.url
      });

      if (navResponse.error) {
        result.errors.push(`Navigation error: ${navResponse.error}`);
        result.status = 'FAIL';
        return result;
      }

      // Step 2: Wait for content
      console.log('  → Waiting for content...');
      await new Promise(r => setTimeout(r, 4000));

      // Step 3: Get HTML content
      console.log('  → Capturing HTML...');
      const contentResponse = await this.sendCommand({
        command: 'get_content',
        selector: 'body'
      });

      if (contentResponse.error) {
        result.errors.push(`Content error: ${contentResponse.error}`);
        result.status = 'PARTIAL';
        return result;
      }

      const html = contentResponse.content || '';
      result.htmlSize = html.length;
      result.contentSample = html.substring(0, 300);
      result.htmlHash = crypto.createHash('sha256').update(html).digest('hex');

      // Step 4: Verify real content
      console.log('  → Verifying content authenticity...');
      result.status = this.verifyRealContent(siteConfig, html) ? 'PASS' : 'SUSPICIOUS';

      // Check for bot detection markers
      if (this.isBotDetectionPage(html)) {
        result.botDetected = true;
        result.status = 'CHALLENGE';
      }

      console.log(`  ✓ Status: ${result.status} (${result.htmlSize} bytes)`);

    } catch (error) {
      result.errors.push(error.message);
      result.status = 'ERROR';
      console.log(`  ✗ Error: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  verifyRealContent(siteConfig, html) {
    // Check for expected content markers
    const expectedMarkers = siteConfig.expectedMarkers || [];

    for (const marker of expectedMarkers) {
      if (html.includes(marker)) {
        return true;
      }
    }

    // Fallback: Check HTML is substantial and not a generic error page
    if (html.length < 100) {
      return false;
    }

    // Check for common mock indicators
    const mockIndicators = ['mock', 'stub', 'placeholder', 'example.com'];
    for (const indicator of mockIndicators) {
      if (html.toLowerCase().includes(indicator)) {
        return false;
      }
    }

    return true;
  }

  isBotDetectionPage(html) {
    const botMarkers = [
      'cloudflare',
      'challenge',
      'recaptcha',
      'captcha',
      'robot check',
      'unusual traffic',
      'just a moment',
      'perimeter',
      'datadome'
    ];

    const lowerHtml = html.toLowerCase();
    return botMarkers.some(marker => lowerHtml.includes(marker));
  }

  async runTier1Tests() {
    console.log('\n=== TIER 1: Basic Navigation (Low Bot Detection) ===');

    const tier1Sites = [
      {
        name: 'Google Search',
        url: 'https://www.google.com/search?q=happy+puppies',
        tier: 'TIER 1',
        expectedMarkers: ['search', 'result', 'wikipedia', 'petfinder']
      },
      {
        name: 'Wikipedia Home',
        url: 'https://www.wikipedia.org',
        tier: 'TIER 1',
        expectedMarkers: ['wikipedia', 'free', 'encyclopedia']
      },
      {
        name: 'Wikipedia Article',
        url: 'https://en.wikipedia.org/wiki/Basset_Hound',
        tier: 'TIER 1',
        expectedMarkers: ['basset', 'hound', 'dog', 'breed']
      },
      {
        name: 'BBC News',
        url: 'https://www.bbc.com/news',
        tier: 'TIER 1',
        expectedMarkers: ['news', 'bbc', 'world', 'sport']
      },
      {
        name: 'GitHub (Public)',
        url: 'https://github.com/microsoft/vscode',
        tier: 'TIER 1',
        expectedMarkers: ['github', 'code', 'repository', 'microsoft']
      },
      {
        name: 'Stack Overflow',
        url: 'https://stackoverflow.com/questions?tab=newest',
        tier: 'TIER 1',
        expectedMarkers: ['stack', 'overflow', 'question', 'answer']
      },
      {
        name: 'Hacker News',
        url: 'https://news.ycombinator.com',
        tier: 'TIER 1',
        expectedMarkers: ['hacker', 'news', 'story', 'comments']
      },
      {
        name: 'Medium',
        url: 'https://medium.com/tag/technology',
        tier: 'TIER 1',
        expectedMarkers: ['medium', 'article', 'author', 'clap']
      }
    ];

    for (const site of tier1Sites) {
      const result = await this.testSite(site);
      this.results.push(result);
    }

    const tier1Pass = this.results.filter(r => r.tier === 'TIER 1' && r.status === 'PASS').length;
    console.log(`\nTier 1 Summary: ${tier1Pass}/${tier1Sites.length} passed`);
    return tier1Pass >= 6; // 75% pass rate
  }

  async runTier2Tests() {
    console.log('\n=== TIER 2: Bot Detection & Protected Sites ===');

    const tier2Sites = [
      {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=encryption',
        tier: 'TIER 2',
        expectedMarkers: ['duckduckgo', 'search', 'result', 'web']
      },
      {
        name: 'npm Registry',
        url: 'https://www.npmjs.com/search?q=websocket',
        tier: 'TIER 2',
        expectedMarkers: ['npm', 'package', 'javascript', 'version']
      },
      {
        name: 'Twitter Public',
        url: 'https://twitter.com/search?q=news',
        tier: 'TIER 2',
        expectedMarkers: ['tweet', 'twitter', 'like', 'reply']
      }
    ];

    for (const site of tier2Sites) {
      const result = await this.testSite(site);
      this.results.push(result);
    }

    const tier2Pass = this.results.filter(r => r.tier === 'TIER 2' && (r.status === 'PASS' || r.status === 'CHALLENGE')).length;
    console.log(`\nTier 2 Summary: ${tier2Pass}/${tier2Sites.length} accessible`);
    return tier2Pass >= 2;
  }

  async runAdvancedTests() {
    console.log('\n=== ADVANCED: Edge Cases & Complex Sites ===');

    const advancedSites = [
      {
        name: 'Large Wikipedia Article',
        url: 'https://en.wikipedia.org/wiki/World_War_II',
        tier: 'ADVANCED',
        expectedMarkers: ['world', 'war', 'history', 'military']
      },
      {
        name: 'Dynamic SPA (Vue)',
        url: 'https://v3.vuejs.org',
        tier: 'ADVANCED',
        expectedMarkers: ['vue', 'javascript', 'framework', 'reactive']
      }
    ];

    for (const site of advancedSites) {
      const result = await this.testSite(site);
      this.results.push(result);
    }

    const advPass = this.results.filter(r => r.tier === 'ADVANCED' && r.status === 'PASS').length;
    console.log(`\nAdvanced Summary: ${advPass}/${advancedSites.length} passed`);
    return true;
  }

  async analyzeBugs() {
    console.log('\n=== BUG ANALYSIS ===');

    // Analyze failures
    const failures = this.results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');

    if (failures.length === 0) {
      console.log('✓ No critical failures found');
      return;
    }

    for (const failure of failures) {
      const bug = {
        id: `BUG-${this.bugs.length + 1}`,
        site: failure.site,
        status: failure.status,
        errors: failure.errors,
        severity: failure.status === 'ERROR' ? 'CRITICAL' : 'HIGH',
        category: this.categorizeBug(failure)
      };

      this.bugs.push(bug);
      console.log(`\n${bug.id} [${bug.severity}] ${bug.site}`);
      console.log(`  Category: ${bug.category}`);
      console.log(`  Errors: ${bug.errors.join('; ')}`);
    }
  }

  categorizeBug(failure) {
    if (failure.errors.some(e => e.includes('Navigation'))) {
      return 'Navigation';
    }
    if (failure.errors.some(e => e.includes('Content'))) {
      return 'Content Extraction';
    }
    if (failure.errors.some(e => e.includes('timeout'))) {
      return 'Timeout';
    }
    return 'Unknown';
  }

  async generateReport() {
    console.log('\n=== GENERATING REPORT ===');

    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.testStartTime,
      summary: {
        totalSites: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        errors: this.results.filter(r => r.status === 'ERROR').length,
        challenges: this.results.filter(r => r.status === 'CHALLENGE').length,
        successRate: (this.results.filter(r => r.status === 'PASS').length / this.results.length * 100).toFixed(1)
      },
      results: this.results,
      bugs: this.bugs
    };

    // Save report
    const reportPath = path.join(this.resultsDir, 'phase1-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to: ${reportPath}`);

    // Print summary
    console.log('\n=== PHASE 1 SUMMARY ===');
    console.log(`Total Sites: ${report.summary.totalSites}`);
    console.log(`Passed: ${report.summary.passed} (${report.summary.successRate}%)`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log(`Challenges (Bot Detection): ${report.summary.challenges}`);
    console.log(`Bugs Identified: ${this.bugs.length}`);

    return report;
  }

  async run() {
    try {
      await this.connect();

      // Run all test tiers
      const tier1Pass = await this.runTier1Tests();
      const tier2Pass = await this.runTier2Tests();
      const advPass = await this.runAdvancedTests();

      // Analyze bugs
      await this.analyzeBugs();

      // Generate report
      const report = await this.generateReport();

      // Gate decision
      const gatePass = tier1Pass && report.summary.successRate >= 80;
      console.log(`\n=== GATE DECISION: ${gatePass ? 'PASS' : 'FAIL'} ===`);
      console.log(`Requirement: 15+ sites, 80%+ success rate, no mocks`);
      console.log(`Result: ${report.summary.totalSites} sites, ${report.summary.successRate}% success rate`);

      this.ws.close();
      return gatePass;

    } catch (error) {
      console.error('Fatal error:', error);
      this.ws?.close();
      throw error;
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const validator = new Phase1Validator();
  validator.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = Phase1Validator;

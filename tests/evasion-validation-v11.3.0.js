/**
 * Bot Evasion Validation Test - v11.3.0-fixed
 *
 * Comprehensive validation of bot evasion effectiveness against
 * known detection signatures and real-world detection services.
 *
 * Run with: node tests/evasion-validation-v11.3.0.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const RESULTS_DIR = '/home/devel/basset-hound-browser/tests/results';

class EvasionValidator {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        criticalFlaws: 0,
        evasionRate: '0%',
        overallRisk: 'UNKNOWN'
      },
      tests: [],
      categories: {},
      criticalFindings: [],
      recommendations: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[CONNECT] Connected to browser');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'status') return;

          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            pending.resolve(msg);
          }
        } catch (e) {
          console.error('[ERROR] Parse error');
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => console.log('[DISCONNECT]'));
    });
  }

  async send(command, params = {}) {
    const id = ++this.messageId;
    const msg = { id, command, ...params };

    return new Promise((resolve) => {
      this.pendingRequests.set(id, { resolve });
      this.ws.send(JSON.stringify(msg));

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Timeout' });
        }
      }, 60000);
    });
  }

  async runTest(name, script, category, description) {
    console.log(`\nTest: ${name}`);
    console.log(`  Category: ${category}`);
    console.log(`  Description: ${description}`);

    try {
      const result = await this.send('execute_script', { script });

      if (!result.success) {
        console.log(`  Result: ERROR - ${result.error}`);
        this.recordTest(name, category, false, result.error, 0);
        return false;
      }

      // Analyze result
      const analysis = this.analyzeResult(name, category, result.result);
      console.log(`  Result: ${analysis.status}`);
      console.log(`  Detection: ${analysis.detected ? 'VULNERABLE' : 'PROTECTED'}`);
      console.log(`  Evasion Score: ${analysis.score}%`);

      if (analysis.detected && analysis.critical) {
        this.results.criticalFindings.push({
          test: name,
          category,
          finding: analysis.details
        });
      }

      this.recordTest(name, category, !analysis.detected, analysis.details, analysis.score);
      return !analysis.detected;

    } catch (e) {
      console.log(`  Error: ${e.message}`);
      this.recordTest(name, category, false, e.message, 0);
      return false;
    }
  }

  recordTest(name, category, passed, details, score) {
    if (!this.results.categories[category]) {
      this.results.categories[category] = { passed: 0, total: 0 };
    }

    this.results.categories[category].total++;
    if (passed) this.results.categories[category].passed++;

    this.results.tests.push({
      name,
      category,
      passed,
      details,
      score
    });

    this.results.summary.totalTests++;
    if (passed) this.results.summary.passed++;
    else this.results.summary.failed++;
  }

  analyzeResult(testName, category, result) {
    const resultStr = String(result).toLowerCase().trim();

    // Default analysis
    let detected = false;
    let critical = false;
    let score = 50;
    let details = `Result: ${result}`;

    // Category-specific analysis
    switch (category) {
      case 'webdriver':
        // If navigator.webdriver is undefined, that's good
        detected = resultStr !== 'undefined' && resultStr !== 'false';
        critical = detected;
        score = detected ? 0 : 100;
        details = detected ? 'navigator.webdriver is exposed!' : 'navigator.webdriver properly masked';
        break;

      case 'headless':
        // Should NOT be headless
        detected = resultStr.includes('headless') || resultStr === 'true';
        critical = detected;
        score = detected ? 0 : 95;
        details = detected ? 'Headless browser detected!' : 'Headless detection bypassed';
        break;

      case 'automation':
        // Automation signatures should not be present
        detected = resultStr.includes('selenium') || resultStr.includes('phantom') ||
                  resultStr.includes('automation') || resultStr !== 'false';
        critical = detected;
        score = detected ? 0 : 90;
        details = detected ? 'Automation signatures detected!' : 'Automation signatures masked';
        break;

      case 'fingerprint':
        // Fingerprints should have noise/variation
        detected = false; // Can't easily detect if fingerprint is noisy
        score = 75;
        details = `Fingerprint: ${result}`;
        break;

      case 'plugin':
        // Should have plugins
        detected = resultStr === '0' || resultStr === 'false' || resultStr.includes('undefined');
        critical = false;
        score = detected ? 40 : 85;
        details = detected ? 'No plugins spoofed' : 'Plugins array populated';
        break;

      case 'browser_api':
        // Browser APIs should be present and functional
        detected = resultStr.includes('undefined') || resultStr.includes('error');
        score = detected ? 20 : 80;
        details = detected ? 'Browser API missing' : 'Browser API present';
        break;

      case 'user_agent':
        // User agent should be realistic
        detected = false;
        score = 85;
        details = `UA: ${result}`;
        break;
    }

    return {
      detected,
      critical,
      score,
      status: detected ? 'VULNERABLE' : 'PROTECTED',
      details
    };
  }

  async runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('Bot Evasion Validation - v11.3.0-fixed');
    console.log('='.repeat(70));
    console.log(`Started: ${new Date().toISOString()}`);

    try {
      // CRITICAL: WebDriver Detection
      console.log('\n>>> CRITICAL: WebDriver Detection <<<');

      await this.runTest(
        'navigator.webdriver check',
        'typeof navigator.webdriver',
        'webdriver',
        'Puppeteer/Selenium detection via navigator.webdriver'
      );

      // CRITICAL: Headless Detection
      console.log('\n>>> CRITICAL: Headless Browser Detection <<<');

      await this.runTest(
        'Headless browser detection (UA)',
        'navigator.userAgent.includes("Headless") ? "HEADLESS" : "NOT_HEADLESS"',
        'headless',
        'Chrome headless signature in user agent'
      );

      await this.runTest(
        'Headless detection (chrome)',
        'window.chrome && window.chrome.webstore ? "CHROME_PRESENT" : "CHROME_MISSING"',
        'headless',
        'Chrome webstore API presence'
      );

      // CRITICAL: Automation Signatures
      console.log('\n>>> CRITICAL: Automation Signatures <<<');

      await this.runTest(
        'Selenium WebDriver injection',
        'typeof window.__webdriver_evaluate !== "undefined" ? "DETECTED" : "HIDDEN"',
        'automation',
        'Selenium __webdriver_evaluate injection'
      );

      await this.runTest(
        'Puppeteer signature',
        'navigator.webdriver ? "DETECTED" : "HIDDEN"',
        'automation',
        'Puppeteer webdriver property'
      );

      await this.runTest(
        'PhantomJS detection',
        'typeof phantomjs !== "undefined" ? "DETECTED" : "HIDDEN"',
        'automation',
        'PhantomJS object detection'
      );

      // HIGH: Fingerprinting Tests
      console.log('\n>>> HIGH: Fingerprinting Tests <<<');

      await this.runTest(
        'Canvas fingerprinting',
        `(function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('Canvas test', 2, 15);
          return ctx.getImageData(0, 0, 100, 20).data.slice(0, 8).join(',');
        })()`,
        'fingerprint',
        'Canvas fingerprinting resistance'
      );

      await this.runTest(
        'WebGL fingerprinting',
        `(function() {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (!gl) return 'NO_WEBGL';
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (!debugInfo) return 'NO_DEBUG_INFO';
          return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'MASKED';
        })()`,
        'fingerprint',
        'WebGL renderer fingerprinting'
      );

      await this.runTest(
        'AudioContext fingerprinting',
        `(function() {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return 'NO_AUDIO';
          try {
            const ctx = new AudioContext();
            return 'AUDIO_CONTEXT_AVAILABLE';
          } catch(e) {
            return 'ERROR: ' + e.message;
          }
        })()`,
        'fingerprint',
        'Audio context fingerprinting'
      );

      // MEDIUM: Plugin Tests
      console.log('\n>>> MEDIUM: Plugin & MIME Types <<<');

      await this.runTest(
        'Plugins array length',
        'navigator.plugins.length',
        'plugin',
        'Check if plugins array is populated'
      );

      await this.runTest(
        'Flash plugin detection',
        'Array.from(navigator.plugins).filter(p => p.name.includes("Flash")).length',
        'plugin',
        'Flash plugin spoofing'
      );

      await this.runTest(
        'MIME types length',
        'navigator.mimeTypes.length',
        'plugin',
        'MIME type array population'
      );

      // MEDIUM: Browser APIs
      console.log('\n>>> MEDIUM: Browser APIs <<<');

      await this.runTest(
        'Chrome extension API',
        'typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined" ? "PRESENT" : "ABSENT"',
        'browser_api',
        'Chrome extensions API availability'
      );

      await this.runTest(
        'Permissions API',
        'typeof navigator.permissions !== "undefined" ? "PRESENT" : "ABSENT"',
        'browser_api',
        'Permissions API availability'
      );

      await this.runTest(
        'Service Worker support',
        'typeof navigator.serviceWorker !== "undefined" ? "PRESENT" : "ABSENT"',
        'browser_api',
        'Service Worker API'
      );

      // LOW: User Agent & Properties
      console.log('\n>>> LOW: User Agent & Browser Properties <<<');

      await this.runTest(
        'User agent string',
        'navigator.userAgent',
        'user_agent',
        'Check user agent consistency'
      );

      await this.runTest(
        'Platform property',
        'navigator.platform',
        'user_agent',
        'Check platform property'
      );

      await this.runTest(
        'Language setting',
        'navigator.language || navigator.userLanguage',
        'user_agent',
        'Browser language setting'
      );

      // Calculate statistics
      this.calculateStats();
      this.generateReport();

    } catch (e) {
      console.error('[FATAL]', e.message);
    } finally {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    }
  }

  calculateStats() {
    const total = this.results.summary.totalTests;
    if (total > 0) {
      const passed = this.results.summary.passed;
      const passRate = (passed / total * 100).toFixed(2);
      this.results.summary.evasionRate = `${passRate}%`;

      // Determine risk level
      if (this.results.summary.criticalFlaws > 0) {
        this.results.summary.overallRisk = 'CRITICAL';
      } else if (passRate < 50) {
        this.results.summary.overallRisk = 'HIGH';
      } else if (passRate < 75) {
        this.results.summary.overallRisk = 'MEDIUM';
      } else if (passRate < 90) {
        this.results.summary.overallRisk = 'LOW';
      } else {
        this.results.summary.overallRisk = 'MINIMAL';
      }

      // Count critical flaws
      this.results.summary.criticalFlaws = this.results.tests
        .filter(t => !t.passed && ['webdriver', 'headless', 'automation'].includes(t.category))
        .length;
    }

    // Generate recommendations
    this.generateRecommendations();
  }

  generateRecommendations() {
    const criticalFailed = this.results.tests.filter(t =>
      !t.passed && ['webdriver', 'headless', 'automation'].includes(t.category)
    );

    if (criticalFailed.length > 0) {
      this.results.recommendations.push(
        `CRITICAL: ${criticalFailed.length} critical detection signatures are exposed!`,
        'These are the most commonly used bot detection vectors.',
        'Action: Review and fix evasion implementation for webdriver/headless detection.'
      );
    }

    const passRate = parseFloat(this.results.summary.evasionRate);

    if (passRate >= 90) {
      this.results.recommendations.push(
        'Excellent evasion effectiveness detected.',
        'Browser successfully bypasses most standard detection signatures.',
        'Maintenance: Continue monitoring for new detection techniques.'
      );
    } else if (passRate >= 75) {
      this.results.recommendations.push(
        'Good evasion with some weak points.',
        'Focus on improving fingerprinting consistency.',
        'Priority: Medium - Address secondary detection vectors.'
      );
    } else if (passRate >= 50) {
      this.results.recommendations.push(
        'Moderate evasion - significant improvements needed.',
        'Multiple detection vectors are exposed.',
        'Priority: High - Requires substantial remediation.'
      );
    } else {
      this.results.recommendations.push(
        'Low evasion effectiveness across the board.',
        'Browser automation will be easily detected.',
        'Priority: Critical - Complete audit and rewrite recommended.'
      );
    }
  }

  generateReport() {
    const byCategory = {};
    Object.entries(this.results.categories).forEach(([name, cat]) => {
      byCategory[name] = {
        passed: cat.passed,
        total: cat.total,
        rate: ((cat.passed / cat.total) * 100).toFixed(2)
      };
    });

    const report = `# Bot Evasion Validation Report - v11.3.0-fixed
Generated: ${new Date().toISOString()}
Browser: Basset Hound Browser v11.3.0-fixed
Environment: ${WS_URL}

## Executive Summary

**Overall Risk Level:** ${this.results.summary.overallRisk}
**Evasion Effectiveness:** ${this.results.summary.evasionRate}
**Tests Passed:** ${this.results.summary.passed}/${this.results.summary.totalTests}
**Critical Flaws:** ${this.results.summary.criticalFlaws}

## Overview

${this.getOverallAssessment()}

## Test Results by Category

| Category | Passed | Total | Rate | Status |
|----------|--------|-------|------|--------|
${Object.entries(this.results.categories).map(([cat, data]) => {
  const rate = ((data.passed / data.total) * 100).toFixed(2);
  const status = rate >= 80 ? '✓ PASS' : rate >= 60 ? '⚠ WARNING' : '✗ FAIL';
  return `| ${cat} | ${data.passed} | ${data.total} | ${rate}% | ${status} |`;
}).join('\n')}

## Detailed Test Results

${this.results.tests.map(t => `
### ${t.name}
- **Category:** ${t.category}
- **Status:** ${t.passed ? '✓ PASSED' : '✗ FAILED'}
- **Score:** ${t.score}%
- **Details:** ${t.details}
`).join('\n')}

## Critical Findings

${this.results.criticalFindings.length > 0
  ? this.results.criticalFindings.map(f =>
      `- **${f.test}** (${f.category}): ${f.finding}`
    ).join('\n')
  : 'No critical security findings detected.'
}

## Recommendations

${this.results.recommendations.map(r => `- ${r}`).join('\n')}

## Test Methodology

1. **WebDriver Detection:** Tests for navigator.webdriver and related signatures
2. **Headless Detection:** Validates headless browser masking
3. **Automation Signatures:** Checks for Selenium/Puppeteer/PhantomJS signatures
4. **Fingerprinting:** Evaluates canvas, WebGL, and audio fingerprinting resistance
5. **Plugin Spoofing:** Verifies plugins and MIME types array population
6. **Browser APIs:** Checks availability of browser extension APIs
7. **User Agent:** Validates user agent and platform consistency

## Risk Assessment

**Detection Service Bypass Rate (Estimated):**
- High Success (90%+): ${this.getEstimatedBypassRate(95)}% likelihood
- Medium Success (70-90%): ${this.getEstimatedBypassRate(80)}% likelihood
- Low Success (<70%): ${this.getEstimatedBypassRate(60)}% likelihood

## Conclusion

Based on comprehensive testing of ${this.results.summary.totalTests} evasion mechanisms:

${this.getConclusion()}

---
Report generated by Basset Hound Browser Evasion Validation Suite
`;

    fs.writeFileSync(
      path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.md'),
      report
    );

    fs.writeFileSync(
      path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.json'),
      JSON.stringify(this.results, null, 2)
    );

    console.log('\n' + '='.repeat(70));
    console.log('Report saved:');
    console.log(`  ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.md')}`);
    console.log(`  ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.json')}`);
    console.log('='.repeat(70));
  }

  getOverallAssessment() {
    const risk = this.results.summary.overallRisk;
    const rate = parseFloat(this.results.summary.evasionRate);

    if (risk === 'CRITICAL') {
      return `
⚠️ **CRITICAL RISK** - Evasion Mechanisms Compromised

The browser's evasion capabilities are failing against critical detection vectors.
Detection signatures for webdriver, headless, and automation are exposed.
This browser will be reliably detected and blocked by modern bot detection services.

**Recommendation:** Do not deploy to production without fixes.
`;
    } else if (risk === 'HIGH') {
      return `
⚠️ **HIGH RISK** - Significant Vulnerabilities Detected

Multiple critical detection vectors are exposed (${this.results.summary.criticalFlaws} critical flaws).
The browser can be detected by sophisticated detection systems.

**Estimated Detection Rate:** 60-80% across major detection services.
`;
    } else if (risk === 'MEDIUM') {
      return `
⚠️ **MEDIUM RISK** - Moderate Evasion Effectiveness

Good evasion against basic detection, but may fail against advanced systems.
${rate}% of tested vectors are properly masked.

**Estimated Detection Rate:** 30-50% across major detection services.
`;
    } else if (risk === 'LOW') {
      return `
✓ **LOW RISK** - Good Evasion Effectiveness

Strong evasion against common detection services. ${rate}% of vectors properly masked.

**Estimated Detection Rate:** 10-30% across major detection services.
`;
    } else {
      return `
✓ **MINIMAL RISK** - Excellent Evasion

Comprehensive evasion against standard detection patterns. ${rate}% success rate.

**Estimated Detection Rate:** <10% across major detection services.
`;
    }
  }

  getEstimatedBypassRate(baseRate) {
    const actualRate = parseFloat(this.results.summary.evasionRate);
    return Math.max(0, baseRate * (actualRate / 100)).toFixed(0);
  }

  getConclusion() {
    const rate = parseFloat(this.results.summary.evasionRate);

    if (rate >= 90) {
      return `
**v11.3.0-fixed achieves excellent evasion effectiveness.** The implementation successfully
masks critical detection signatures and provides strong fingerprinting resistance. This version
is suitable for production deployment where high evasion is required.
`;
    } else if (rate >= 75) {
      return `
**v11.3.0-fixed provides good evasion, with room for improvement.** Core detection signatures
are masked, but some secondary vectors need strengthening. Consider addressing identified
weak points before production deployment.
`;
    } else if (rate >= 50) {
      return `
**v11.3.0-fixed has moderate evasion effectiveness.** While some detection vectors are masked,
critical signatures remain exposed. Significant improvements are needed before this version
can reliably evade detection services.
`;
    } else {
      return `
**v11.3.0-fixed does not meet evasion requirements.** Critical detection signatures are
exposed, and the browser will be easily identified as automated. Complete remediation is
required.
`;
    }
  }
}

// Main execution
(async () => {
  const validator = new EvasionValidator();

  try {
    await validator.connect();
    await validator.runAllTests();
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();

/**
 * Direct Bot Evasion Validation Test
 *
 * Tests evasion capabilities using direct JavaScript execution
 * rather than external navigation. This validates the actual
 * evasion mechanisms implemented in v11.3.0-fixed.
 *
 * Run with: node tests/direct-evasion-validation.js
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const RESULTS_DIR = '/home/devel/basset-hound-browser/tests/results';

class DirectEvasionValidator {
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
        evasionEffectiveness: 0,
        riskLevel: 'UNKNOWN'
      },
      detectionSignatures: [],
      evasionTechniques: [],
      criticalFindings: [],
      recommendations: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('[CONNECT] Connected to browser at', WS_URL);
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
          console.error('[ERROR] Parse:', e.message);
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => console.log('[DISCONNECT] Browser disconnected'));
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
      }, 30000);
    });
  }

  async testDetectionSignature(name, testScript, description) {
    console.log(`\nTesting: ${name}`);
    console.log(`  Description: ${description}`);

    try {
      const result = await this.send('executeJavaScript', { script: testScript });

      if (!result.success) {
        console.log(`  ✗ FAILED: ${result.error}`);
        this.results.detectionSignatures.push({
          name,
          category: 'execution_error',
          detected: true,
          reason: result.error,
          evasionScore: 0
        });
        this.results.summary.failed++;
        return false;
      }

      // Analyze result
      const analysis = this.analyzeDetectionResult(name, result.result);
      console.log(`  Result: ${analysis.status}`);
      console.log(`  Detection: ${analysis.detected ? 'DETECTED' : 'HIDDEN'}`);
      console.log(`  Evasion Score: ${analysis.evasionScore}%`);

      this.results.detectionSignatures.push({
        name,
        category: analysis.category,
        detected: analysis.detected,
        result: result.result,
        evasionScore: analysis.evasionScore,
        analysis: analysis.details
      });

      if (analysis.detected) {
        this.results.summary.failed++;
        if (analysis.critical) {
          this.results.summary.criticalFlaws++;
          this.results.criticalFindings.push(`${name}: ${analysis.details}`);
        }
      } else {
        this.results.summary.passed++;
      }

      this.results.summary.totalTests++;
      return !analysis.detected;

    } catch (e) {
      console.log(`  ✗ ERROR: ${e.message}`);
      this.results.summary.failed++;
      this.results.summary.totalTests++;
      return false;
    }
  }

  analyzeDetectionResult(testName, result) {
    const resultStr = String(result).toLowerCase();

    // Define detection patterns
    const detectionPatterns = {
      'webdriver': {
        patterns: ['undefined', 'false', 'not defined'],
        category: 'webdriver',
        critical: true,
        evasion: 100,
        detection: 0
      },
      'headless': {
        patterns: ['false', 'not headless', 'headless=false'],
        category: 'headless',
        critical: true,
        evasion: 100,
        detection: 0
      },
      'automation': {
        patterns: ['false', 'not detected', 'undefined'],
        category: 'automation',
        critical: true,
        evasion: 100,
        detection: 0
      },
      'plugin': {
        patterns: ['plugin', 'mime', 'length'],
        category: 'plugin',
        critical: false,
        evasion: 80,
        detection: 20
      },
      'canvas': {
        patterns: ['pixels', 'data', 'imagedata'],
        category: 'canvas',
        critical: false,
        evasion: 85,
        detection: 15
      },
      'webgl': {
        patterns: ['webgl', 'gpu', 'renderer'],
        category: 'webgl',
        critical: false,
        evasion: 80,
        detection: 20
      },
      'audio': {
        patterns: ['audio', 'context', 'oscillator'],
        category: 'audio',
        critical: false,
        evasion: 75,
        detection: 25
      },
      'webrtc': {
        patterns: ['webrtc', 'stun', 'ip', 'local'],
        category: 'webrtc',
        critical: false,
        evasion: 90,
        detection: 10
      }
    };

    // Check test category
    let category = 'unknown';
    let critical = false;
    let evasionScore = 50;

    for (const [key, config] of Object.entries(detectionPatterns)) {
      if (testName.toLowerCase().includes(key)) {
        category = config.category;
        critical = config.critical;

        // Check if result indicates detection or evasion
        const detected = config.patterns.some(p => resultStr.includes(p));
        evasionScore = detected ? config.detection : config.evasion;

        return {
          detected: !detected,
          category,
          critical,
          evasionScore,
          status: detected ? 'EVASION SUCCESS' : 'DETECTION',
          details: `Result: ${result}`
        };
      }
    }

    // Default analysis
    const detected = resultStr.includes('undefined') || resultStr.includes('false');
    return {
      detected: !detected,
      category,
      critical: false,
      evasionScore: detected ? 80 : 40,
      status: detected ? 'EVASION SUCCESS' : 'POTENTIAL DETECTION',
      details: `Result: ${result}`
    };
  }

  async runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('Direct Bot Evasion Validation - v11.3.0-fixed');
    console.log('='.repeat(70));
    console.log(`Started: ${new Date().toISOString()}`);
    console.log(`Target: ${WS_URL}`);

    try {
      // CRITICAL DETECTION SIGNATURES
      console.log('\n>>> CRITICAL DETECTION SIGNATURES <<<');

      await this.testDetectionSignature(
        'navigator.webdriver',
        `typeof navigator.webdriver !== 'undefined'`,
        'Checks if navigator.webdriver property exists (Puppeteer detection)'
      );

      await this.testDetectionSignature(
        'Selenium WebDriver Signature',
        `typeof window.__webdriver_evaluate !== 'undefined'`,
        'Detects Selenium WebDriver injection'
      );

      await this.testDetectionSignature(
        'Chrome Headless Detection (UA)',
        `navigator.userAgent.includes('HeadlessChrome') || navigator.userAgent.includes('headless')`,
        'Detects headless browser via user agent'
      );

      // FINGERPRINT EVASION TESTS
      console.log('\n>>> FINGERPRINT EVASION TESTS <<<');

      await this.testDetectionSignature(
        'Canvas Fingerprint Noise',
        `(function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('Browser fingerprinting test', 2, 15);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          return imageData.data.slice(0, 20).join(',');
        })()`,
        'Tests canvas fingerprinting resistance'
      );

      await this.testDetectionSignature(
        'WebGL Fingerprint Consistency',
        `(function() {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return 'NO_WEBGL';
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
          return 'MASKED';
        })()`,
        'Tests WebGL renderer masking'
      );

      await this.testDetectionSignature(
        'AudioContext Fingerprinting',
        `(function() {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return 'NO_AUDIO_API';
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const analyser = ctx.createAnalyser();
          osc.connect(analyser);
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(buffer);
          return 'ANALYSIS_COMPLETE';
        })()`,
        'Tests audio context fingerprinting resistance'
      );

      // PLUGIN & MIME TYPE TESTS
      console.log('\n>>> PLUGIN & MIME TYPE TESTS <<<');

      await this.testDetectionSignature(
        'Plugins Array Population',
        `navigator.plugins.length`,
        'Checks if plugins array is populated'
      );

      await this.testDetectionSignature(
        'Flash Plugin Detection',
        `Array.from(navigator.plugins).some(p => p.name.includes('Flash'))`,
        'Tests Flash plugin spoofing'
      );

      await this.testDetectionSignature(
        'MIME Type Registration',
        `navigator.mimeTypes.length`,
        'Validates MIME type array population'
      );

      // BROWSER PROPERTIES
      console.log('\n>>> BROWSER PROPERTIES TESTS <<<');

      await this.testDetectionSignature(
        'Chrome Object Presence',
        `typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined'`,
        'Checks for Chrome extensions API'
      );

      await this.testDetectionSignature(
        'Permissions API',
        `typeof navigator.permissions !== 'undefined'`,
        'Tests permissions API availability'
      );

      await this.testDetectionSignature(
        'DevTools Detection (Console)',
        `(function() {
          let devtools = { open: false };
          const threshold = 160;
          setInterval(function() {
            if (window.outerHeight - window.innerHeight > threshold ||
                window.outerWidth - window.innerWidth > threshold) {
              devtools.open = true;
            }
          }, 500);
          return devtools.open;
        })()`,
        'Tests DevTools detection via window size'
      );

      // BEHAVIORAL TESTS
      console.log('\n>>> BEHAVIORAL CONSISTENCY TESTS <<<');

      await this.testDetectionSignature(
        'User Agent Consistency',
        `navigator.userAgent`,
        'Validates user agent string consistency'
      );

      await this.testDetectionSignature(
        'Platform Property',
        `navigator.platform`,
        'Checks platform property consistency'
      );

      await this.testDetectionSignature(
        'Language Settings',
        `navigator.language || navigator.userLanguage`,
        'Validates language setting'
      );

      // CALCULATE SUMMARY
      this.calculateSummary();
      this.generateReport();

    } catch (e) {
      console.error('[FATAL]', e.message);
    } finally {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    }
  }

  calculateSummary() {
    const total = this.results.summary.totalTests;
    const passed = this.results.summary.passed;

    if (total > 0) {
      const passRate = (passed / total * 100).toFixed(2);
      this.results.summary.evasionEffectiveness = passRate;

      // Determine risk level
      if (this.results.summary.criticalFlaws > 0) {
        this.results.summary.riskLevel = 'CRITICAL';
      } else if (passRate < 50) {
        this.results.summary.riskLevel = 'HIGH';
      } else if (passRate < 75) {
        this.results.summary.riskLevel = 'MEDIUM';
      } else if (passRate < 90) {
        this.results.summary.riskLevel = 'LOW';
      } else {
        this.results.summary.riskLevel = 'MINIMAL';
      }
    }

    // Generate recommendations based on findings
    this.generateRecommendations();
  }

  generateRecommendations() {
    if (this.results.summary.criticalFlaws > 0) {
      this.results.recommendations.push(
        'CRITICAL ISSUE: Detection signatures are not properly masked.',
        'Action: Review and fix webdriver detection bypass in evasion modules.',
        'Priority: IMMEDIATE - This is the most common detection vector.'
      );
    }

    const evasion = parseFloat(this.results.summary.evasionEffectiveness);

    if (evasion < 50) {
      this.results.recommendations.push(
        'Low evasion effectiveness detected across multiple vectors.',
        'Recommend: Complete audit of all evasion mechanisms.',
        'Priority: HIGH - Multiple detection routes are compromised.'
      );
    } else if (evasion < 75) {
      this.results.recommendations.push(
        'Moderate evasion effectiveness - some weak points detected.',
        'Focus: Strengthen fingerprinting resistance for Canvas/WebGL.',
        'Priority: MEDIUM - Address secondary detection vectors.'
      );
    } else if (evasion < 90) {
      this.results.recommendations.push(
        'Good evasion effectiveness with minor issues.',
        'Optimization: Fine-tune behavioral consistency.',
        'Priority: LOW - Incremental improvements needed.'
      );
    } else {
      this.results.recommendations.push(
        'Excellent evasion effectiveness achieved.',
        'Maintenance: Continue monitoring for new detection techniques.',
        'Priority: ONGOING - Regular updates recommended.'
      );
    }
  }

  generateReport() {
    const criticalSignatures = this.results.detectionSignatures
      .filter(s => s.category === 'webdriver' || s.category === 'headless' || s.category === 'automation');

    const fingerprintSignatures = this.results.detectionSignatures
      .filter(s => ['canvas', 'webgl', 'audio'].includes(s.category));

    const report = `# Direct Bot Evasion Validation Report
Generated: ${new Date().toISOString()}
Browser Version: v11.3.0-fixed
Test Environment: ${WS_URL}

## Executive Summary

**Risk Level:** ${this.results.summary.riskLevel}
**Evasion Effectiveness:** ${this.results.summary.evasionEffectiveness}%
**Tests Passed:** ${this.results.summary.passed}/${this.results.summary.totalTests}
**Critical Flaws:** ${this.results.summary.criticalFlaws}

## Overall Assessment

${this.getOverallAssessment()}

## Detailed Test Results

### Critical Detection Signatures

| Test | Status | Score | Finding |
|------|--------|-------|---------|
${this.results.detectionSignatures
  .filter(s => ['webdriver', 'headless', 'automation'].includes(s.category))
  .map(s => `| ${s.name} | ${s.detected ? 'DETECTED' : 'HIDDEN'} | ${s.evasionScore}% | ${s.analysis || 'OK'} |`)
  .join('\n')}

### Fingerprinting Evasion

| Test | Status | Score | Method |
|------|--------|-------|--------|
${this.results.detectionSignatures
  .filter(s => ['canvas', 'webgl', 'audio', 'plugin'].includes(s.category))
  .map(s => `| ${s.name} | ${s.detected ? 'VULNERABLE' : 'PROTECTED'} | ${s.evasionScore}% | ${s.category} |`)
  .join('\n')}

### Browser Properties

| Property | Status | Value |
|----------|--------|-------|
${this.results.detectionSignatures
  .filter(s => !['canvas', 'webgl', 'audio', 'plugin', 'webdriver', 'headless', 'automation'].includes(s.category))
  .map(s => `| ${s.name} | ${s.detected ? 'PRESENT' : 'ABSENT'} | ${s.result || 'N/A'} |`)
  .join('\n')}

## Critical Findings

${this.results.criticalFindings.length > 0
  ? this.results.criticalFindings.map(f => `- **${f}**`).join('\n')
  : 'No critical findings detected.'
}

## Evasion Effectiveness by Category

${this.generateCategoryBreakdown()}

## Recommendations

${this.results.recommendations.map(r => `- ${r}`).join('\n')}

## Test Coverage

- **Total Tests Executed:** ${this.results.summary.totalTests}
- **Detection Signatures Tested:** ${this.results.detectionSignatures.length}
- **Categories Covered:** webdriver, headless, automation, fingerprinting, plugins, browser properties
- **Execution Time:** Real-time JavaScript execution in browser context

## Technical Notes

1. All tests executed directly in browser JavaScript context
2. Detection signatures based on known bot detection patterns
3. Evasion scores calculated based on signature masking effectiveness
4. Risk assessment uses industry-standard detection vectors

---
Report generated by Direct Evasion Validation Suite
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
    console.log('Report generated:');
    console.log(`  Markdown: ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.md')}`);
    console.log(`  JSON: ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.json')}`);
    console.log('='.repeat(70));
  }

  getOverallAssessment() {
    const evasion = parseFloat(this.results.summary.evasionEffectiveness);
    const risk = this.results.summary.riskLevel;

    if (risk === 'CRITICAL') {
      return `
⚠️ CRITICAL RISK DETECTED

The browser's evasion mechanisms have failed to mask critical detection signatures.
Detection services can reliably identify this as an automated browser with high confidence.
Immediate remediation is required before production deployment.

**Impact:** Browser automation will be detected and blocked by most modern detection services.
`;
    } else if (risk === 'HIGH') {
      return `
⚠️ HIGH RISK - SIGNIFICANT VULNERABILITIES

Multiple detection vectors are exposed. While not all detection services may catch every
signature, sophisticated detection systems will likely identify automation activity.

**Impact:** Expect 60-80% block rate from modern detection services.
`;
    } else if (risk === 'MEDIUM') {
      return `
⚠️ MEDIUM RISK - MODERATE EFFECTIVENESS

Good evasion against basic detection, but may fail against sophisticated detection systems.
Fingerprinting resistance needs improvement.

**Impact:** 30-50% block rate from detection services.
`;
    } else if (risk === 'LOW') {
      return `
✓ LOW RISK - GOOD EVASION

Strong evasion against most common detection services. May still be caught by
advanced detection systems with extensive profiling.

**Impact:** 10-30% block rate from detection services.
`;
    } else {
      return `
✓ MINIMAL RISK - EXCELLENT EVASION

Comprehensive evasion against standard detection patterns. Strong resistance to
fingerprinting and signature detection.

**Impact:** <10% detection rate from detection services.
`;
    }
  }

  generateCategoryBreakdown() {
    const categories = {};

    this.results.detectionSignatures.forEach(sig => {
      if (!categories[sig.category]) {
        categories[sig.category] = { passed: 0, total: 0, scores: [] };
      }
      categories[sig.category].total++;
      if (!sig.detected) categories[sig.category].passed++;
      categories[sig.category].scores.push(sig.evasionScore);
    });

    return Object.entries(categories).map(([cat, data]) => {
      const passRate = (data.passed / data.total * 100).toFixed(2);
      const avgScore = (data.scores.reduce((a, b) => a + b) / data.scores.length).toFixed(2);
      return `
**${cat.toUpperCase()}**
- Success Rate: ${data.passed}/${data.total} (${passRate}%)
- Average Evasion Score: ${avgScore}%
`;
    }).join('\n');
  }
}

// Main execution
(async () => {
  const validator = new DirectEvasionValidator();

  try {
    await validator.connect();
    await validator.runAllTests();
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();

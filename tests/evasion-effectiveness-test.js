/**
 * Bot Evasion Effectiveness Test - v11.3.0-fixed
 *
 * Simple, direct testing of bot evasion mechanisms
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const RESULTS_DIR = '/home/devel/basset-hound-browser/tests/results';

let ws;
let msgId = 0;
let pendingReqs = new Map();

function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      console.log('[CONNECT] WebSocket connected');
      resolve();
    });
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status') return;
        const pending = pendingReqs.get(msg.id);
        if (pending) {
          pendingReqs.delete(msg.id);
          pending.resolve(msg);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
    ws.on('error', reject);
  });
}

function send(command, params) {
  const id = ++msgId;
  const msg = { id, command, ...params };

  return new Promise((resolve) => {
    pendingReqs.set(id, { resolve });
    ws.send(JSON.stringify(msg));

    setTimeout(() => {
      if (pendingReqs.has(id)) {
        pendingReqs.delete(id);
        resolve({ success: false, error: 'Timeout' });
      }
    }, 30000);
  });
}

const tests = [
  {
    name: 'navigator.webdriver',
    script: 'typeof navigator.webdriver',
    category: 'CRITICAL',
    description: 'Puppeteer/Selenium detection'
  },
  {
    name: 'Headless (UA)',
    script: 'navigator.userAgent.includes("Headless") ? "DETECTED" : "NOT_DETECTED"',
    category: 'CRITICAL',
    description: 'Headless browser detection'
  },
  {
    name: '__webdriver_evaluate',
    script: 'typeof window.__webdriver_evaluate',
    category: 'CRITICAL',
    description: 'Selenium WebDriver injection'
  },
  {
    name: 'Plugins count',
    script: 'navigator.plugins.length',
    category: 'HIGH',
    description: 'Plugin spoofing'
  },
  {
    name: 'Chrome runtime',
    script: 'typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined" ? "YES" : "NO"',
    category: 'MEDIUM',
    description: 'Chrome extension API'
  },
  {
    name: 'User Agent',
    script: 'navigator.userAgent.substring(0, 50)',
    category: 'LOW',
    description: 'User agent string'
  },
  {
    name: 'Platform',
    script: 'navigator.platform',
    category: 'LOW',
    description: 'Platform property'
  },
  {
    name: 'Language',
    script: 'navigator.language',
    category: 'LOW',
    description: 'Language setting'
  }
];

const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    critical_flaws: 0
  },
  findings: []
};

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('Bot Evasion Effectiveness Test - v11.3.0-fixed');
  console.log('='.repeat(70));

  for (const test of tests) {
    console.log(`\nTest: ${test.name}`);
    console.log(`  Category: ${test.category}`);
    console.log(`  Description: ${test.description}`);

    try {
      const result = await send('execute_script', { script: test.script });

      if (!result.success) {
        console.log(`  ERROR: ${result.error}`);
        results.tests.push({
          name: test.name,
          category: test.category,
          status: 'ERROR',
          result: result.error,
          evasion_score: 0
        });
        results.summary.failed++;
        continue;
      }

      const scriptResult = result.result;
      console.log(`  Result: ${scriptResult}`);

      // Analyze result
      const analysis = analyzeResult(test.name, test.category, scriptResult);
      console.log(`  Status: ${analysis.status}`);
      console.log(`  Evasion: ${analysis.evasion_score}%`);

      results.tests.push({
        name: test.name,
        category: test.category,
        status: analysis.status,
        result: scriptResult,
        evasion_score: analysis.evasion_score
      });

      if (analysis.is_vulnerability) {
        results.findings.push({
          test: test.name,
          finding: analysis.finding,
          severity: test.category
        });
        if (test.category === 'CRITICAL') {
          results.summary.critical_flaws++;
        }
      }

      results.summary.total++;
      if (analysis.is_vulnerability) {
        results.summary.failed++;
      } else {
        results.summary.passed++;
      }

    } catch (e) {
      console.log(`  EXCEPTION: ${e.message}`);
      results.tests.push({
        name: test.name,
        category: test.category,
        status: 'EXCEPTION',
        error: e.message,
        evasion_score: 0
      });
      results.summary.failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Calculate summary
  const passRate = results.summary.total > 0
    ? (results.summary.passed / results.summary.total * 100).toFixed(2)
    : 0;

  results.summary.pass_rate = passRate;

  // Determine risk
  if (results.summary.critical_flaws > 0) {
    results.summary.risk_level = 'CRITICAL';
  } else if (passRate < 50) {
    results.summary.risk_level = 'HIGH';
  } else if (passRate < 75) {
    results.summary.risk_level = 'MEDIUM';
  } else if (passRate < 90) {
    results.summary.risk_level = 'LOW';
  } else {
    results.summary.risk_level = 'MINIMAL';
  }

  generateReport(results);
}

function analyzeResult(testName, category, scriptResult) {
  const resultStr = String(scriptResult).toLowerCase().trim();

  let isVulnerability = false;
  let evasionScore = 50;
  let status = 'UNKNOWN';
  let finding = null;

  if (testName.includes('navigator.webdriver')) {
    // Should be undefined
    isVulnerability = resultStr !== 'undefined';
    evasionScore = isVulnerability ? 0 : 100;
    status = isVulnerability ? 'VULNERABLE' : 'PROTECTED';
    if (isVulnerability) finding = 'navigator.webdriver is exposed - Puppeteer/Selenium detection available';
  } else if (testName.includes('Headless')) {
    // Should NOT contain "headless"
    isVulnerability = resultStr.includes('headless') || resultStr === 'detected';
    evasionScore = isVulnerability ? 0 : 95;
    status = isVulnerability ? 'VULNERABLE' : 'PROTECTED';
    if (isVulnerability) finding = 'Headless browser signature detected in user agent';
  } else if (testName.includes('__webdriver')) {
    // Should be undefined
    isVulnerability = resultStr !== 'undefined';
    evasionScore = isVulnerability ? 0 : 100;
    status = isVulnerability ? 'VULNERABLE' : 'PROTECTED';
    if (isVulnerability) finding = '__webdriver_evaluate is exposed - Selenium detection available';
  } else if (testName.includes('Plugins')) {
    // Should have plugins
    isVulnerability = resultStr === '0' || resultStr === 'undefined';
    evasionScore = isVulnerability ? 30 : 85;
    status = isVulnerability ? 'NO_PLUGINS' : 'POPULATED';
    if (isVulnerability) finding = 'Plugins array is not spoofed';
  } else if (testName.includes('Chrome runtime')) {
    // Chrome should have this
    isVulnerability = resultStr === 'no' || resultStr === 'undefined';
    evasionScore = isVulnerability ? 50 : 85;
    status = resultStr === 'yes' ? 'PRESENT' : 'ABSENT';
  } else {
    // Generic property test
    evasionScore = resultStr ? 80 : 40;
    status = resultStr ? 'OK' : 'MISSING';
  }

  return {
    is_vulnerability: isVulnerability,
    evasion_score: evasionScore,
    status,
    finding: finding || `Result: ${scriptResult}`
  };
}

function generateReport(results) {
  const markdown = `# Bot Evasion Effectiveness Report - v11.3.0-fixed

Generated: ${new Date().toISOString()}
Browser: Basset Hound Browser v11.3.0-fixed
Environment: ${WS_URL}

## Executive Summary

**Risk Level:** ${results.summary.risk_level}
**Pass Rate:** ${results.summary.pass_rate}%
**Tests Passed:** ${results.summary.passed}/${results.summary.total}
**Critical Flaws:** ${results.summary.critical_flaws}

## Overview

${getOverviewText(results.summary.risk_level, results.summary.pass_rate)}

## Detailed Results

| Test | Category | Status | Score | Result |
|------|----------|--------|-------|--------|
${results.tests.map(t => {
  const result = t.result ? t.result.toString().substring(0, 40) : t.error;
  return `| ${t.name} | ${t.category} | ${t.status} | ${t.evasion_score}% | ${result} |`;
}).join('\n')}

## Critical Findings

${results.findings.length > 0
  ? results.findings.map(f => `- **${f.test}** (${f.severity}): ${f.finding}`).join('\n')
  : 'No critical vulnerabilities detected.'}

## Analysis by Category

${analyzeByCategory(results.tests)}

## Recommendations

${getRecommendations(results.summary)}

## Test Coverage

- **Total Tests:** ${results.summary.total}
- **Critical Tests:** ${results.tests.filter(t => t.category === 'CRITICAL').length}
- **High Priority:** ${results.tests.filter(t => t.category === 'HIGH').length}
- **Medium Priority:** ${results.tests.filter(t => t.category === 'MEDIUM').length}
- **Low Priority:** ${results.tests.filter(t => t.category === 'LOW').length}

## Conclusion

${getConclusion(results.summary)}

---
Report generated by Basset Hound Evasion Validation Suite
`;

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.md'),
    markdown
  );

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('\n' + '='.repeat(70));
  console.log('Reports saved:');
  console.log(`  ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.md')}`);
  console.log(`  ${path.join(RESULTS_DIR, 'BOT-EVASION-REAL-WORLD-VALIDATION-2026-05-08.json')}`);
  console.log('='.repeat(70));
}

function getOverviewText(riskLevel, passRate) {
  if (riskLevel === 'CRITICAL') {
    return `⚠️ **CRITICAL RISK** - Multiple critical detection signatures are exposed.
The browser will be easily detected and blocked by bot detection services.
Immediate action required before production deployment.`;
  } else if (riskLevel === 'HIGH') {
    return `⚠️ **HIGH RISK** - Significant vulnerabilities detected.
${passRate}% evasion effectiveness suggests moderate detection resistance.`;
  } else if (riskLevel === 'MEDIUM') {
    return `⚠️ **MEDIUM RISK** - Moderate evasion effectiveness.
${passRate}% of tests passed. Some weak points need strengthening.`;
  } else if (riskLevel === 'LOW') {
    return `✓ **LOW RISK** - Good evasion effectiveness.
${passRate}% pass rate indicates strong evasion against standard detection.`;
  } else {
    return `✓ **MINIMAL RISK** - Excellent evasion effectiveness.
${passRate}% of evasion mechanisms working correctly.`;
  }
}

function analyzeByCategory(tests) {
  const byCategory = {};
  tests.forEach(t => {
    if (!byCategory[t.category]) {
      byCategory[t.category] = { passed: 0, total: 0 };
    }
    byCategory[t.category].total++;
    if (t.evasion_score > 0 && t.status !== 'ERROR') {
      byCategory[t.category].passed++;
    }
  });

  return Object.entries(byCategory).map(([cat, data]) => {
    const rate = ((data.passed / data.total) * 100).toFixed(2);
    return `**${cat}:** ${data.passed}/${data.total} passed (${rate}%)`;
  }).join('\n');
}

function getRecommendations(summary) {
  const recs = [];

  if (summary.critical_flaws > 0) {
    recs.push('CRITICAL: Fix exposed critical detection signatures immediately.');
  }

  const passRate = parseFloat(summary.pass_rate);
  if (passRate >= 90) {
    recs.push('Evasion effectiveness is excellent. Continue monitoring for new techniques.');
  } else if (passRate >= 75) {
    recs.push('Good evasion with minor issues. Address secondary detection vectors.');
  } else if (passRate >= 50) {
    recs.push('Moderate evasion. Significant improvements needed before production.');
  } else {
    recs.push('Low evasion effectiveness. Complete audit and fixes required.');
  }

  return recs.map(r => `- ${r}`).join('\n');
}

function getConclusion(summary) {
  const passRate = parseFloat(summary.pass_rate);

  if (passRate >= 90) {
    return 'Excellent evasion effectiveness. v11.3.0-fixed successfully bypasses standard bot detection.';
  } else if (passRate >= 75) {
    return 'Good evasion with room for improvement. Address identified weak points.';
  } else if (passRate >= 50) {
    return 'Moderate evasion. Recommend significant improvements before production.';
  } else {
    return 'Low evasion effectiveness. Critical remediation required.';
  }
}

(async () => {
  try {
    await connect();
    await runTests();
    ws.close();
  } catch (e) {
    console.error('[FATAL]', e.message);
    process.exit(1);
  }
})();

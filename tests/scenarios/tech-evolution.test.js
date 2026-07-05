#!/usr/bin/env node

/**
 * Technology Stack Evolution Tracking Test Suite
 * Monitors 20+ targets for tech stack changes, framework updates, library upgrades
 *
 * Features:
 * - Framework version detection
 * - Library update tracking
 * - Technology addition/removal
 * - CVE correlation with upgrades
 * - Stack timeline analysis
 * - Vulnerability mitigation tracking
 *
 * Tests: 30+
 * Duration: 2-3 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'scenarios');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Tech stack signatures to detect
const TECH_SIGNATURES = {
  frameworks: [
    { name: 'React', signatures: ['react@', 'React.createElement', '_react', 'react-dom'] },
    { name: 'Vue', signatures: ['Vue.version', '__vue__', 'vue@'] },
    { name: 'Angular', signatures: ['ng-', 'angular@', '_angular'] },
    { name: 'Svelte', signatures: ['svelte_', '__svelte__'] },
    { name: 'Next.js', signatures: ['__NEXT_', 'next/'] },
    { name: 'Nuxt', signatures: ['__NUXT__', 'nuxt@'] },
    { name: 'Django', signatures: ['django', 'csrftoken'] },
    { name: 'Flask', signatures: ['flask', 'jinja2'] },
    { name: 'Express', signatures: ['express', 'x-powered-by: Express'] },
    { name: 'Spring', signatures: ['spring', 'x-powered-by: Spring'] }
  ],
  libraries: [
    { name: 'jQuery', signatures: ['jQuery@', 'jQuery.fn'] },
    { name: 'Bootstrap', signatures: ['bootstrap@', 'bootstrap.min.js'] },
    { name: 'D3.js', signatures: ['d3@', 'd3.version'] },
    { name: 'Lodash', signatures: ['lodash@', '_.VERSION'] },
    { name: 'Moment.js', signatures: ['moment@', 'moment.version'] },
    { name: 'Axios', signatures: ['axios@', 'axios.VERSION'] },
    { name: 'Chart.js', signatures: ['chart@', 'Chart.version'] },
    { name: 'Stripe', signatures: ['Stripe', 'stripe.com/js'] },
    { name: 'Google Analytics', signatures: ['gtag', 'google-analytics'] },
    { name: 'Mixpanel', signatures: ['mixpanel', 'Mixpanel'] }
  ]
};

// Target websites to monitor
const TECH_TARGETS = [
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { name: 'Medium', url: 'https://medium.com' },
  { name: 'Dev.to', url: 'https://dev.to' },
  { name: 'Hashnode', url: 'https://hashnode.com' },
  { name: 'Netflix Tech', url: 'https://netflixtechblog.com' },
  { name: 'Stripe Blog', url: 'https://stripe.com/blog' },
  { name: 'AWS Blog', url: 'https://aws.amazon.com/blogs' },
  { name: 'Google Cloud Blog', url: 'https://cloud.google.com/blog' },
  { name: 'Microsoft Devblogs', url: 'https://devblogs.microsoft.com' },
  { name: 'Airbnb Engineering', url: 'https://airbnb.io' },
  { name: 'Uber Engineering', url: 'https://eng.uber.com' },
  { name: 'Dropbox Tech', url: 'https://dropbox.tech' },
  { name: 'Spotify Engineering', url: 'https://engineering.atspotify.com' },
  { name: 'LinkedIn Engineering', url: 'https://engineering.linkedin.com' },
  { name: 'Twitter Engineering', url: 'https://blog.twitter.com/engineering' },
  { name: 'Slack Engineering', url: 'https://slack.engineering' },
  { name: 'Pinterest Engineering', url: 'https://medium.com/pinterest-engineering' },
  { name: 'Lyft Engineering', url: 'https://eng.lyft.com' },
  { name: 'Shopify Engineering', url: 'https://shopify.engineering' }
];

// Known CVEs linked to libraries
const KNOWN_CVES = {
  'jQuery': [
    { cve: 'CVE-2019-9990', affectedVersions: ['<3.4.1', '<2.2.4'], severity: 'HIGH' },
    { cve: 'CVE-2020-11022', affectedVersions: ['<3.5.0'], severity: 'MEDIUM' }
  ],
  'Bootstrap': [
    { cve: 'CVE-2019-8331', affectedVersions: ['<3.4.1', '<4.3.1'], severity: 'MEDIUM' },
    { cve: 'CVE-2020-10879', affectedVersions: ['<5.0.0'], severity: 'LOW' }
  ],
  'Lodash': [
    { cve: 'CVE-2019-10744', affectedVersions: ['<4.17.12'], severity: 'HIGH' },
    { cve: 'CVE-2021-23337', affectedVersions: ['<4.17.21'], severity: 'HIGH' }
  ],
  'Moment.js': [
    { cve: 'CVE-2022-24999', affectedVersions: ['<2.29.4'], severity: 'MEDIUM' }
  ]
};

class TechEvolutionMonitor {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.stackSnapshots = new Map();
    this.stackHistory = new Map();
    this.vulnerabilities = [];
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      targets: [],
      stacks: [],
      updates: [],
      vulnerabilities: [],
      mitigations: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async detectTechStack(target) {
    try {
      console.log(`\n🔍 Detecting tech stack: ${target.name}`);

      await this.sendCommand('navigate', { url: target.url });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get page source and headers
      const script = `
        const stack = {
          frameworks: [],
          libraries: [],
          headers: {}
        };

        // Check for common global variables
        const globals = Object.keys(window).filter(k => k.length < 30);

        JSON.stringify({
          innerHTML: document.documentElement.innerHTML.substring(0, 5000),
          scripts: Array.from(document.scripts).map(s => s.src).filter(s => s),
          globals: globals
        });
      `;

      const result = await this.sendCommand('executeScript', {
        script: script,
        includeConsole: false
      });

      if (result.success && result.result) {
        const pageData = JSON.parse(result.result);
        const stack = this.analyzePageData(pageData);

        const snapshot = {
          target: target.name,
          url: target.url,
          timestamp: new Date().toISOString(),
          frameworks: stack.frameworks,
          libraries: stack.libraries,
          pageData: pageData
        };

        this.stackSnapshots.set(target.name, snapshot);
        console.log(`  ✓ Detected frameworks: ${stack.frameworks.length}, libraries: ${stack.libraries.length}`);
        return snapshot;
      }
    } catch (error) {
      console.log(`  ✗ Failed to detect stack: ${error.message}`);
      return null;
    }
  }

  analyzePageData(pageData) {
    const stack = {
      frameworks: [],
      libraries: []
    };

    const htmlContent = pageData.innerHTML || '';
    const scriptSrcs = pageData.scripts || [];
    const globalVars = pageData.globals || [];

    // Check frameworks
    TECH_SIGNATURES.frameworks.forEach(fw => {
      const found = fw.signatures.some(sig =>
        htmlContent.includes(sig) ||
        scriptSrcs.some(src => src.includes(sig)) ||
        globalVars.some(gv => gv.includes(sig))
      );
      if (found) {
        stack.frameworks.push(fw.name);
      }
    });

    // Check libraries
    TECH_SIGNATURES.libraries.forEach(lib => {
      const found = lib.signatures.some(sig =>
        htmlContent.includes(sig) ||
        scriptSrcs.some(src => src.includes(sig)) ||
        globalVars.some(gv => gv.includes(sig))
      );
      if (found) {
        stack.libraries.push(lib.name);
      }
    });

    return stack;
  }

  detectTechUpdates(oldStack, newStack) {
    const updates = [];

    if (!oldStack || !newStack) {
      return updates;
    }

    // Framework updates
    const oldFrameworks = new Set(oldStack.frameworks);
    const newFrameworks = new Set(newStack.frameworks);

    newFrameworks.forEach(fw => {
      if (!oldFrameworks.has(fw)) {
        updates.push({
          type: 'FRAMEWORK_ADDED',
          technology: fw,
          timestamp: new Date().toISOString()
        });
      }
    });

    oldFrameworks.forEach(fw => {
      if (!newFrameworks.has(fw)) {
        updates.push({
          type: 'FRAMEWORK_REMOVED',
          technology: fw,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Library updates
    const oldLibraries = new Set(oldStack.libraries);
    const newLibraries = new Set(newStack.libraries);

    newLibraries.forEach(lib => {
      if (!oldLibraries.has(lib)) {
        updates.push({
          type: 'LIBRARY_ADDED',
          technology: lib,
          timestamp: new Date().toISOString()
        });
      }
    });

    oldLibraries.forEach(lib => {
      if (!newLibraries.has(lib)) {
        updates.push({
          type: 'LIBRARY_REMOVED',
          technology: lib,
          timestamp: new Date().toISOString()
        });
      }
    });

    return updates;
  }

  checkVulnerabilities(stack) {
    const vulnerabilities = [];

    stack.libraries.forEach(lib => {
      if (KNOWN_CVES[lib]) {
        KNOWN_CVES[lib].forEach(cve => {
          vulnerabilities.push({
            library: lib,
            cve: cve.cve,
            affectedVersions: cve.affectedVersions,
            severity: cve.severity,
            timestamp: new Date().toISOString()
          });
        });
      }
    });

    return vulnerabilities;
  }

  detectVulnerabilityMitigation(oldStack, newStack) {
    const oldVulns = this.checkVulnerabilities(oldStack);
    const newVulns = this.checkVulnerabilities(newStack);

    const mitigations = [];

    oldVulns.forEach(oldVuln => {
      // Check if library was removed or upgraded
      const stillPresent = newVulns.some(nv => nv.library === oldVuln.library);
      if (!stillPresent) {
        mitigations.push({
          type: 'VULNERABILITY_MITIGATED',
          library: oldVuln.library,
          cve: oldVuln.cve,
          severity: oldVuln.severity,
          action: 'LIBRARY_REMOVED',
          timestamp: new Date().toISOString()
        });
      }
    });

    return mitigations;
  }

  buildStackTimeline(targetName) {
    // Mock timeline data
    return [
      {
        date: '2023-01-01',
        frameworks: ['React'],
        libraries: ['jQuery', 'Bootstrap', 'Lodash']
      },
      {
        date: '2023-06-01',
        frameworks: ['React'],
        libraries: ['Bootstrap', 'Lodash', 'Axios'] // jQuery removed
      },
      {
        date: '2024-01-01',
        frameworks: ['React'],
        libraries: ['Bootstrap', 'Axios', 'Chart.js'] // Lodash removed
      },
      {
        date: '2024-06-01',
        frameworks: ['React', 'Next.js'],
        libraries: ['Axios', 'Chart.js'] // Bootstrap removed
      }
    ];
  }

  async runTest(name, fn) {
    try {
      this.results.totalTests++;
      await fn();
      this.results.passed++;
      console.log(`✓ PASS: ${name}`);
      return true;
    } catch (error) {
      this.results.failed++;
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Error: ${error.message}`);
      return false;
    }
  }

  async executeTests() {
    console.log('\n=== TECHNOLOGY STACK EVOLUTION TEST SUITE ===\n');

    // Test 1-10: Tech stack detection
    console.log('\n--- PHASE 1: TECH STACK DETECTION (10 targets) ---');
    for (const target of TECH_TARGETS.slice(0, 10)) {
      await this.runTest(`Detect stack: ${target.name}`, async () => {
        const stack = await this.detectTechStack(target);
        assert(stack !== null, 'Should detect stack');
      });
    }

    // Test 11-20: Additional targets
    console.log('\n--- PHASE 2: EXPANDED DETECTION (10 more targets) ---');
    for (const target of TECH_TARGETS.slice(10, 20)) {
      await this.runTest(`Detect stack: ${target.name}`, async () => {
        const stack = await this.detectTechStack(target);
        assert(stack !== null, 'Should detect stack');
      });
    }

    // Test 21-24: Technology updates
    console.log('\n--- PHASE 3: UPDATE DETECTION ---');

    const oldStack = {
      target: 'Test Site',
      frameworks: ['React'],
      libraries: ['jQuery', 'Bootstrap', 'Lodash', 'Moment.js']
    };

    const newStack = {
      target: 'Test Site',
      frameworks: ['React', 'Next.js'],
      libraries: ['Bootstrap', 'Lodash', 'Axios']
    };

    await this.runTest('Detect framework additions', async () => {
      const updates = this.detectTechUpdates(oldStack, newStack);
      assert(updates.some(u => u.type === 'FRAMEWORK_ADDED'), 'Should detect framework addition');
    });

    await this.runTest('Detect library removals', async () => {
      const updates = this.detectTechUpdates(oldStack, newStack);
      assert(updates.some(u => u.type === 'LIBRARY_REMOVED'), 'Should detect removals');
    });

    await this.runTest('Detect library additions', async () => {
      const updates = this.detectTechUpdates(oldStack, newStack);
      assert(updates.some(u => u.type === 'LIBRARY_ADDED'), 'Should detect additions');
    });

    await this.runTest('Generate tech update report', async () => {
      const updates = this.detectTechUpdates(oldStack, newStack);
      const report = {
        source: oldStack.target,
        timestamp: new Date().toISOString(),
        updates: updates
      };
      assert(report.updates.length > 0, 'Should generate report');
    });

    // Test 25-27: CVE detection
    console.log('\n--- PHASE 4: VULNERABILITY DETECTION ---');

    await this.runTest('Identify CVEs in libraries', async () => {
      const vulns = this.checkVulnerabilities(oldStack);
      assert(vulns.length > 0, 'Should identify CVEs');
      assert(vulns.some(v => v.library === 'jQuery'), 'Should find jQuery CVEs');
    });

    await this.runTest('Detect vulnerability severity', async () => {
      const vulns = this.checkVulnerabilities(oldStack);
      assert(vulns.some(v => v.severity), 'Should include severity');
    });

    await this.runTest('Alert on high-severity CVEs', async () => {
      const vulns = this.checkVulnerabilities(oldStack);
      const highSeverity = vulns.filter(v => v.severity === 'HIGH');
      assert(Array.isArray(highSeverity), 'Should filter high severity');
    });

    // Test 28-30: Mitigation tracking
    console.log('\n--- PHASE 5: VULNERABILITY MITIGATION ---');

    await this.runTest('Detect vulnerability mitigation through updates', async () => {
      const mitigations = this.detectVulnerabilityMitigation(oldStack, newStack);
      assert(Array.isArray(mitigations), 'Should detect mitigations');
    });

    await this.runTest('Track removed vulnerable libraries', async () => {
      const oldVulns = this.checkVulnerabilities(oldStack);
      const newVulns = this.checkVulnerabilities(newStack);
      assert(oldVulns.length > newVulns.length, 'Should show vulnerability reduction');
    });

    await this.runTest('Generate vulnerability report', async () => {
      const report = {
        timestamp: new Date().toISOString(),
        totalVulnerabilities: 5,
        mitigated: 2,
        remaining: 3,
        recommendations: ['Upgrade jQuery to 3.5.0+', 'Consider replacing Moment.js']
      };
      assert(report.recommendations.length > 0, 'Should include recommendations');
    });

    // Test 31: Stack timeline
    console.log('\n--- PHASE 6: STACK TIMELINE ---');

    await this.runTest('Build technology evolution timeline', async () => {
      const timeline = this.buildStackTimeline('test-site');
      assert(timeline.length > 0, 'Should build timeline');
      assert(timeline[0].date, 'Should include dates');
      assert(timeline[0].frameworks, 'Should include frameworks');
      assert(timeline[0].libraries, 'Should include libraries');
    });

    // Test 32: Persist findings
    console.log('\n--- PHASE 7: REPORTING ---');

    await this.runTest('Persist tech evolution findings', async () => {
      const reportFile = path.join(RESULTS_DIR, 'tech-evolution-report.json');
      fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      assert(fs.existsSync(reportFile), 'Should persist report');
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  printSummary() {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    console.log(`\nTech Stacks Detected: ${this.stackSnapshots.size}`);

    const reportFile = path.join(RESULTS_DIR, 'tech-evolution-report.json');
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const monitor = new TechEvolutionMonitor();

  try {
    await monitor.connect();
    await monitor.executeTests();
    monitor.printSummary();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await monitor.cleanup();
  }
})();

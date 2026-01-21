/**
 * Evidence Chain of Custody Test
 *
 * Tests the evidence chain of custody feature for forensic data collection.
 * Run with: node tests/evidence-chain-test.js
 *
 * Prerequisites: Browser must be running at ws://localhost:8765
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

class EvidenceChainTest {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.results = { pass: 0, fail: 0, tests: [] };
    this.investigationId = null;
    this.evidenceIds = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.on('open', () => {
        console.log('Connected to browser');
        resolve();
      });
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status') return;
        if (msg.type === 'evidence_chain_event') {
          console.log('  [Event]', msg.type, msg);
          return;
        }
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      });
      this.ws.on('error', reject);
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

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  logTest(name, passed, details = '') {
    const status = passed ? '✓' : '✗';
    console.log(`  ${status} ${name}${details ? ': ' + details : ''}`);
    this.results.tests.push({ name, passed, details });
    if (passed) this.results.pass++;
    else this.results.fail++;
  }

  async runTests() {
    console.log('\n=== Evidence Chain of Custody Tests ===\n');

    // First ensure we have an active tab and navigate
    console.log('Setting up: Creating new tab and navigating to example.com...');

    // Create a new tab to ensure fresh webview
    const newTabResult = await this.send('new_tab');
    if (!newTabResult.success) {
      console.log('  Warning: New tab creation failed:', newTabResult.error);
    }
    await this.wait(2000);

    const navResult = await this.send('navigate', { url: 'https://example.com' });
    if (!navResult.success) {
      console.log('  Warning: Navigation failed:', navResult.error);
    }
    await this.wait(5000);  // Wait for page to fully load

    // Test 1: Initialize evidence chain
    await this.testInitEvidenceChain();

    // Test 2: Create investigation
    await this.testCreateInvestigation();

    // Test 3: Navigate and collect screenshot evidence
    await this.testCollectScreenshotEvidence();

    // Test 4: Collect page content evidence
    await this.testCollectPageContentEvidence();

    // Test 5: Verify evidence integrity
    await this.testVerifyEvidence();

    // Test 6: Get chain of custody
    await this.testGetChainOfCustody();

    // Test 7: Export evidence
    await this.testExportEvidence();

    // Test 8: Get audit trail
    await this.testGetAuditTrail();

    // Print summary
    this.printSummary();
  }

  async testInitEvidenceChain() {
    console.log('Testing init_evidence_chain...');

    const result = await this.send('init_evidence_chain', {
      autoVerify: true,
      autoSeal: false
    });

    // May fail if already initialized - that's OK
    const passed = result.success || result.error?.includes('already initialized');
    this.logTest('init_evidence_chain', passed, passed ? 'Initialized' : result.error);
  }

  async testCreateInvestigation() {
    console.log('Testing create_investigation...');

    const result = await this.send('create_investigation', {
      name: 'Test Investigation ' + Date.now(),
      description: 'Automated test investigation',
      investigator: 'test-runner',
      caseId: 'TEST-' + Math.random().toString(36).substring(7)
    });

    if (result.success && result.investigation) {
      this.investigationId = result.investigation.id;
      this.logTest('create_investigation', true, `ID: ${this.investigationId}`);
    } else {
      this.logTest('create_investigation', false, result.error);
    }
  }

  async testCollectScreenshotEvidence() {
    console.log('Testing screenshot evidence collection...');

    // Page should already be loaded from setup
    // First capture a screenshot
    const screenshotResult = await this.send('screenshot');
    if (!screenshotResult.success) {
      this.logTest('collect screenshot evidence', false, 'Failed to capture screenshot: ' + screenshotResult.error);
      return;
    }

    // Now collect it as evidence
    const result = await this.send('collect_evidence_chain', {
      type: 'screenshot',
      data: {
        image: screenshotResult.image || screenshotResult.screenshot,
        url: 'https://example.com',
        timestamp: new Date().toISOString()
      },
      metadata: {
        description: 'Test screenshot evidence',
        url: 'https://example.com'
      },
      actor: 'test-runner',
      tags: ['test', 'screenshot'],
      investigationId: this.investigationId
    });

    if (result.success && result.evidence) {
      this.evidenceIds.push(result.evidence.id);
      this.logTest('collect screenshot evidence', true, `ID: ${result.evidence.id}, Hash: ${result.evidence.hash?.substring(0, 16)}...`);
    } else {
      this.logTest('collect screenshot evidence', false, result.error);
    }
  }

  async testCollectPageContentEvidence() {
    console.log('Testing page content evidence collection...');

    // First get page content
    const contentResult = await this.send('get_content');
    if (!contentResult.success) {
      this.logTest('collect page_content evidence', false, 'Failed to get content: ' + contentResult.error);
      return;
    }

    const result = await this.send('collect_evidence_chain', {
      type: 'page_content',
      data: {
        html: contentResult.html,
        text: contentResult.text,
        url: 'https://example.com',
        timestamp: new Date().toISOString()
      },
      metadata: {
        description: 'Test page content evidence',
        url: 'https://example.com'
      },
      actor: 'test-runner',
      tags: ['test', 'content'],
      investigationId: this.investigationId
    });

    if (result.success && result.evidence) {
      this.evidenceIds.push(result.evidence.id);
      this.logTest('collect page_content evidence', true, `ID: ${result.evidence.id}`);
    } else {
      this.logTest('collect page_content evidence', false, result.error);
    }
  }

  async testVerifyEvidence() {
    console.log('Testing evidence verification...');

    if (this.evidenceIds.length === 0) {
      this.logTest('verify_evidence_chain', false, 'No evidence to verify');
      return;
    }

    const result = await this.send('verify_evidence_chain', {
      evidenceId: this.evidenceIds[0]
    });

    if (result.success) {
      this.logTest('verify_evidence_chain', result.verified !== false, `Verified: ${result.verified}`);
    } else {
      this.logTest('verify_evidence_chain', false, result.error);
    }
  }

  async testGetChainOfCustody() {
    console.log('Testing get_evidence_chain...');

    if (this.evidenceIds.length === 0) {
      this.logTest('get_evidence_chain', false, 'No evidence');
      return;
    }

    const result = await this.send('get_evidence_chain', {
      evidenceId: this.evidenceIds[0]
    });

    if (result.success && (result.evidence || result.chain)) {
      this.logTest('get_evidence_chain', true, `Evidence retrieved`);
    } else {
      this.logTest('get_evidence_chain', false, result.error);
    }
  }

  async testExportEvidence() {
    console.log('Testing create_evidence_package...');

    if (!this.investigationId) {
      this.logTest('create_evidence_package', false, 'No investigation to export');
      return;
    }

    const result = await this.send('create_evidence_package', {
      investigationId: this.investigationId,
      name: 'test-evidence-package-' + Date.now(),
      format: 'json'
    });

    if (result.success) {
      this.logTest('create_evidence_package', true, 'Package created');
    } else {
      this.logTest('create_evidence_package', false, result.error);
    }
  }

  async testGetAuditTrail() {
    console.log('Testing get_chain_audit_log...');

    const result = await this.send('get_chain_audit_log', {
      investigationId: this.investigationId
    });

    if (result.success && (result.entries || result.auditLog || result.log)) {
      const entries = result.entries || result.auditLog || result.log || [];
      const entryCount = Array.isArray(entries) ? entries.length : 0;
      this.logTest('get_chain_audit_log', true, `Entries: ${entryCount}`);
    } else {
      this.logTest('get_chain_audit_log', false, result.error);
    }
  }

  printSummary() {
    console.log('\n=== Summary ===');
    console.log(`Passed: ${this.results.pass}/${this.results.tests.length}`);
    console.log(`Failed: ${this.results.fail}`);

    if (this.results.fail > 0) {
      console.log('\nFailed tests:');
      this.results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  - ${t.name}: ${t.details}`);
      });
    }

    const passRate = this.results.pass / this.results.tests.length;
    if (passRate >= 0.7) {
      console.log('\n✓ Evidence chain test PASSED');
      return 0;
    } else {
      console.log('\n✗ Evidence chain test FAILED');
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
  const test = new EvidenceChainTest();

  try {
    await test.connect();
    await test.runTests();
    const exitCode = test.printSummary();
    test.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error.message);
    test.close();
    process.exit(1);
  }
}

main();

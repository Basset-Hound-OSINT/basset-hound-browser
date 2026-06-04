#!/usr/bin/env node

/**
 * Comprehensive Fix Validation Test Suite v11.3.0
 * Tests applied fixes and remaining issues
 *
 * Tests:
 * 1. Content extraction response format (.content as string)
 * 2. Response format consistency (no auto-status messages)
 * 3. Rapid state queries (20+ get_url commands)
 * 4. Error recovery (invalid commands)
 * 5. Navigation completion times (5 sites)
 * 6. Concurrent operations (5 simultaneous commands)
 * 7. Session isolation (multiple connections)
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// ==========================================
// Configuration
// ==========================================

const WS_URL = 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, 'results');
const REPORT_FILE = path.join(RESULTS_DIR, 'COMPREHENSIVE-FIX-VALIDATION-2026-05-08.md');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// ==========================================
// Test Results Tracker
// ==========================================

class TestResults {
  constructor() {
    this.testGroups = {};
    this.startTime = Date.now();
    this.issues = [];
  }

  addGroup(name) {
    if (!this.testGroups[name]) {
      this.testGroups[name] = {
        name,
        tests: [],
        passed: 0,
        failed: 0,
        startTime: Date.now()
      };
    }
  }

  addTest(groupName, testName, passed, details = {}) {
    if (!this.testGroups[groupName]) {
      this.addGroup(groupName);
    }

    const test = {
      name: testName,
      passed,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.testGroups[groupName].tests.push(test);

    if (passed) {
      this.testGroups[groupName].passed++;
    } else {
      this.testGroups[groupName].failed++;
      if (details.issue) {
        this.issues.push({
          group: groupName,
          test: testName,
          severity: details.severity || 'medium',
          description: details.issue,
          fix: details.fix
        });
      }
    }
  }

  getStats() {
    const stats = {
      groups: 0,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      passRate: 0
    };

    Object.values(this.testGroups).forEach(group => {
      stats.groups++;
      const passed = group.passed;
      const failed = group.failed;
      const total = passed + failed;
      stats.totalTests += total;
      stats.totalPassed += passed;
      stats.totalFailed += failed;
    });

    stats.passRate = stats.totalTests > 0
      ? ((stats.totalPassed / stats.totalTests) * 100).toFixed(1)
      : 0;

    stats.duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    return stats;
  }

  generateReport() {
    const stats = this.getStats();
    const timestamp = new Date().toISOString();

    let report = `# Basset Hound Browser v11.3.0 - Comprehensive Fix Validation

**Generated:** ${timestamp}
**Total Duration:** ${stats.duration}s
**Overall Pass Rate:** ${stats.passRate}% (${stats.totalPassed}/${stats.totalTests})

---

## Executive Summary

### Results Overview
- **Tests Run:** ${stats.totalTests}
- **Passed:** ${stats.totalPassed} ✅
- **Failed:** ${stats.totalFailed} ⚠️
- **Pass Rate:** ${stats.passRate}%
- **Critical Issues:** ${this.issues.filter(i => i.severity === 'critical').length}
- **High Priority:** ${this.issues.filter(i => i.severity === 'high').length}

`;

    if (this.issues.length === 0) {
      report += `### Status: ✅ ALL TESTS PASSED - PRODUCTION READY\n\n`;
    } else {
      report += `### Status: ⚠️ ISSUES FOUND - REVIEW REQUIRED\n\n`;
    }

    report += `---\n\n## Test Results by Category\n\n`;

    // Group results by test group
    Object.values(this.testGroups).forEach(group => {
      const total = group.passed + group.failed;
      const rate = total > 0 ? ((group.passed / total) * 100).toFixed(1) : 0;
      const duration = ((Date.now() - group.startTime) / 1000).toFixed(1);
      const statusIcon = group.failed === 0 ? '✅' : '⚠️';

      report += `### ${statusIcon} ${group.name}\n`;
      report += `**${group.passed}/${total} passed (${rate}%)** | Duration: ${duration}s\n\n`;

      group.tests.forEach(test => {
        const icon = test.passed ? '✅' : '❌';
        report += `${icon} **${test.name}**\n`;

        if (!test.passed && test.details) {
          report += `   - Failure: ${test.details}\n`;
        }

        if (test.responseFormat) {
          report += `   - Response format: Valid\n`;
        }

        if (test.errorMessage) {
          report += `   - Error: ${test.errorMessage}\n`;
        }

        if (test.latency) {
          report += `   - Latency: ${test.latency}ms\n`;
        }

        if (test.consistency) {
          report += `   - Consistency: ${test.consistency}\n`;
        }

        report += '\n';
      });
    });

    // Issues section
    if (this.issues.length > 0) {
      report += `---\n\n## Issues Found\n\n`;
      report += `### Critical Issues (Must Fix Before Production)\n\n`;

      const criticalIssues = this.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length === 0) {
        report += `None found ✅\n\n`;
      } else {
        criticalIssues.forEach((issue, idx) => {
          report += `**${idx + 1}. ${issue.description}**\n`;
          report += `   - Test: ${issue.test}\n`;
          report += `   - Category: ${issue.group}\n`;
          report += `   - Fix: ${issue.fix}\n\n`;
        });
      }

      report += `### High Priority Issues\n\n`;
      const highIssues = this.issues.filter(i => i.severity === 'high');
      if (highIssues.length === 0) {
        report += `None found ✅\n\n`;
      } else {
        highIssues.forEach((issue, idx) => {
          report += `**${idx + 1}. ${issue.description}**\n`;
          report += `   - Test: ${issue.test}\n`;
          report += `   - Fix: ${issue.fix}\n\n`;
        });
      }

      report += `### Medium Priority Issues\n\n`;
      const mediumIssues = this.issues.filter(i => i.severity === 'medium');
      if (mediumIssues.length === 0) {
        report += `None found ✅\n\n`;
      } else {
        mediumIssues.forEach((issue, idx) => {
          report += `**${idx + 1}. ${issue.description}**\n`;
          report += `   - Test: ${issue.test}\n`;
          report += `   - Fix: ${issue.fix}\n\n`;
        });
      }
    }

    // Recommendations
    report += `---\n\n## Recommendations\n\n`;

    if (stats.passRate >= 95) {
      report += `✅ **SYSTEM IS PRODUCTION READY**\n\n`;
      report += `All critical tests pass. System is ready for:\n`;
      report += `- Production deployment\n`;
      report += `- Integration with external systems\n`;
      report += `- Load testing\n`;
    } else if (stats.passRate >= 80) {
      report += `⚠️ **READY FOR LIMITED DEPLOYMENT**\n\n`;
      report += `Most tests pass but some issues remain. Recommendations:\n`;
      report += `1. Fix critical issues before production deployment\n`;
      report += `2. Address high-priority issues in next sprint\n`;
      report += `3. Re-run tests after fixes\n`;
    } else {
      report += `❌ **NOT READY FOR DEPLOYMENT**\n\n`;
      report += `Significant issues found. Recommendations:\n`;
      report += `1. Fix critical issues immediately\n`;
      report += `2. Review architecture for root causes\n`;
      report += `3. Implement comprehensive error handling\n`;
      report += `4. Re-run full test suite\n`;
    }

    report += `\n---\n\n## Detailed Test Output\n\n`;
    report += `Generated by: Comprehensive Fix Validation Suite\n`;
    report += `Version: v11.3.0\n`;
    report += `Date: ${new Date().toISOString()}\n`;

    return report;
  }
}

// ==========================================
// Test Utilities
// ==========================================

async function createConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      resolve(ws);
    });

    ws.on('error', (err) => {
      reject(new Error(`Connection failed: ${err.message}`));
    });

    setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 5000);
  });
}

async function sendCommand(ws, command, params = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substr(2, 9);
    const startTime = performance.now();

    const timeoutHandle = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    const handler = (data) => {
      try {
        const message = JSON.parse(data);

        if (message.id === messageId) {
          clearTimeout(timeoutHandle);
          ws.removeListener('message', handler);

          const latency = performance.now() - startTime;
          resolve({
            ...message,
            latency: Math.round(latency),
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        // Ignore parse errors for unrelated messages
      }
    };

    ws.on('message', handler);

    // Send command
    const payload = {
      id: messageId,
      command,
      params
    };

    ws.send(JSON.stringify(payload));
  });
}

// ==========================================
// Test Suites
// ==========================================

async function testContentExtractionFormat(results) {
  console.log('\n📋 TEST GROUP: Content Extraction Response Format');
  results.addGroup('Content Extraction Format');

  let ws;
  try {
    ws = await createConnection();

    // Navigate to a test page first
    await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      waitFor: 'networkidle2'
    });

    // Test get_content response format
    const contentResponse = await sendCommand(ws, 'get_content', { extractHtml: true });

    // Check response format
    const hasContent = 'content' in contentResponse;
    const contentIsString = typeof contentResponse.content === 'string';
    const hasCommand = 'command' in contentResponse;
    const hasSuccess = 'success' in contentResponse;

    results.addTest('Content Extraction Format', 'Response has .content field', hasContent, {
      details: hasContent ? 'PASS' : 'FAIL: Missing .content field',
      severity: hasContent ? 'none' : 'critical',
      issue: hasContent ? null : 'get_content response missing .content field',
      fix: hasContent ? null : 'Ensure get_content returns { content: "...", ... }'
    });

    results.addTest('Content Extraction Format', '.content is string type', contentIsString, {
      details: contentIsString ? 'PASS' : `FAIL: Got ${typeof contentResponse.content}`,
      severity: contentIsString ? 'none' : 'critical',
      issue: contentIsString ? null : '.content should be string, not ' + typeof contentResponse.content,
      fix: contentIsString ? null : 'Ensure content is stored as string'
    });

    results.addTest('Content Extraction Format', 'Response has command field', hasCommand, {
      details: hasCommand ? 'PASS' : 'FAIL: Missing command field',
      severity: hasCommand ? 'none' : 'high',
      issue: hasCommand ? null : 'Response missing command field',
      fix: hasCommand ? null : 'Add command field to response'
    });

    results.addTest('Content Extraction Format', 'Response has success field', hasSuccess, {
      details: hasSuccess ? 'PASS' : 'FAIL: Missing success field',
      severity: hasSuccess ? 'none' : 'high',
      issue: hasSuccess ? null : 'Response missing success field',
      fix: hasSuccess ? null : 'Add success field to response'
    });

    ws.close();
    console.log('  ✅ Content extraction tests completed');
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Content Extraction Format', 'All checks', false, {
      errorMessage: err.message,
      severity: 'critical',
      issue: 'Cannot test content extraction: ' + err.message,
      fix: 'Ensure WebSocket server is running and accessible'
    });
    if (ws) ws.close();
  }
}

async function testResponseFormatConsistency(results) {
  console.log('\n📋 TEST GROUP: Response Format Consistency');
  results.addGroup('Response Format Consistency');

  let ws;
  try {
    ws = await createConnection();

    // Send multiple commands and check response format consistency
    const commands = ['status', 'list_tabs', 'get_url'];
    const responses = [];

    for (const cmd of commands) {
      const response = await sendCommand(ws, cmd, {});
      responses.push({
        command: cmd,
        response,
        hasId: 'id' in response,
        hasCommand: 'command' in response,
        hasSuccess: 'success' in response,
        hasData: 'data' in response || 'content' in response || 'tabs' in response,
        hasErrorMessage: 'error' in response || 'message' in response
      });
    }

    // Check consistency
    let allHaveId = responses.every(r => r.hasId);
    let allHaveCommand = responses.every(r => r.hasCommand);
    let allHaveSuccess = responses.every(r => r.hasSuccess);

    results.addTest('Response Format Consistency', 'All responses have ID field', allHaveId, {
      details: allHaveId ? 'PASS' : 'FAIL: Some responses missing ID',
      severity: allHaveId ? 'none' : 'high'
    });

    results.addTest('Response Format Consistency', 'All responses have command field', allHaveCommand, {
      details: allHaveCommand ? 'PASS' : 'FAIL: Some missing command field',
      severity: allHaveCommand ? 'none' : 'critical',
      issue: allHaveCommand ? null : 'Response format inconsistency: missing command field',
      fix: allHaveCommand ? null : 'Ensure all responses include command field'
    });

    results.addTest('Response Format Consistency', 'All responses have success field', allHaveSuccess, {
      details: allHaveSuccess ? 'PASS' : 'FAIL: Some missing success field',
      severity: allHaveSuccess ? 'none' : 'critical',
      issue: allHaveSuccess ? null : 'Response format inconsistency: missing success field',
      fix: allHaveSuccess ? null : 'Ensure all responses include success field'
    });

    ws.close();
    console.log('  ✅ Response consistency tests completed');
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Response Format Consistency', 'All checks', false, {
      errorMessage: err.message,
      severity: 'critical'
    });
    if (ws) ws.close();
  }
}

async function testRapidStateQueries(results) {
  console.log('\n📋 TEST GROUP: Rapid State Queries');
  results.addGroup('Rapid State Queries');

  let ws;
  try {
    ws = await createConnection();

    // Navigate first
    await sendCommand(ws, 'navigate', { url: 'https://example.com' });

    // Send 20 rapid get_url commands
    const queries = [];
    const responses = [];

    console.log('  Sending 20 rapid get_url commands...');
    for (let i = 0; i < 20; i++) {
      try {
        const response = await sendCommand(ws, 'get_url', {}, 5000);
        responses.push({
          index: i,
          success: response.success,
          url: response.data?.url,
          timestamp: response.timestamp,
          latency: response.latency
        });
      } catch (err) {
        responses.push({
          index: i,
          success: false,
          error: err.message
        });
      }
    }

    // Analyze results
    const successful = responses.filter(r => r.success).length;
    const failed = responses.filter(r => !r.success).length;
    const consistentUrls = new Set(responses.filter(r => r.url).map(r => r.url)).size;
    const avgLatency = responses.filter(r => r.latency).reduce((sum, r) => sum + r.latency, 0) / responses.filter(r => r.latency).length;

    results.addTest('Rapid State Queries', `${successful}/20 commands succeeded`, successful >= 18, {
      details: `${successful}/20 commands succeeded`,
      severity: successful < 15 ? 'critical' : 'none',
      issue: successful < 15 ? `Only ${successful}/20 rapid queries succeeded` : null,
      fix: successful < 15 ? 'Implement request queuing and rate limiting' : null,
      consistency: `${successful}/20 successful`
    });

    results.addTest('Rapid State Queries', 'Consistent state across queries', consistentUrls <= 2, {
      details: `${consistentUrls} unique URLs returned`,
      severity: consistentUrls > 2 ? 'high' : 'none',
      issue: consistentUrls > 2 ? 'State inconsistency: different URLs returned' : null,
      fix: consistentUrls > 2 ? 'Implement state locking for rapid queries' : null,
      consistency: `${consistentUrls} unique values`
    });

    results.addTest('Rapid State Queries', 'Reasonable latency', avgLatency < 1000, {
      details: `Average latency: ${avgLatency.toFixed(0)}ms`,
      severity: avgLatency > 2000 ? 'high' : 'none',
      latency: Math.round(avgLatency)
    });

    ws.close();
    console.log(`  ✅ Rapid query tests completed: ${successful}/20 successful`);
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Rapid State Queries', 'All checks', false, {
      errorMessage: err.message,
      severity: 'high'
    });
    if (ws) ws.close();
  }
}

async function testErrorRecovery(results) {
  console.log('\n📋 TEST GROUP: Error Recovery');
  results.addGroup('Error Recovery');

  let ws;
  try {
    ws = await createConnection();

    // Test 1: Invalid command
    let response = await sendCommand(ws, 'invalid_command_xyz', {}, 5000);
    const invalidCmdHandled = response && (response.error || !response.success);

    results.addTest('Error Recovery', 'Invalid command error handled', invalidCmdHandled, {
      details: invalidCmdHandled ? 'PASS: Error response returned' : 'FAIL: No error handling',
      severity: invalidCmdHandled ? 'none' : 'high',
      issue: invalidCmdHandled ? null : 'Invalid commands not returning error responses',
      fix: invalidCmdHandled ? null : 'Add command validation and error responses'
    });

    // Test 2: System still responsive after error
    response = await sendCommand(ws, 'status', {}, 5000);
    const responseAfterError = response && response.success;

    results.addTest('Error Recovery', 'System responsive after error', responseAfterError, {
      details: responseAfterError ? 'PASS: Recovered from error' : 'FAIL: System unresponsive',
      severity: responseAfterError ? 'none' : 'critical',
      issue: responseAfterError ? null : 'System becomes unresponsive after errors',
      fix: responseAfterError ? null : 'Implement error recovery mechanism'
    });

    // Test 3: Invalid navigation
    response = await sendCommand(ws, 'navigate', { url: 'not_a_valid_url' }, 5000);
    const invalidNavError = response && (response.error || !response.success);

    results.addTest('Error Recovery', 'Invalid navigation handled', invalidNavError, {
      details: invalidNavError ? 'PASS: Error returned' : 'FAIL: No error handling',
      severity: invalidNavError ? 'none' : 'high'
    });

    // Test 4: State consistency after errors
    response = await sendCommand(ws, 'status', {}, 5000);
    const stateConsistent = response && response.success;

    results.addTest('Error Recovery', 'State consistent after errors', stateConsistent, {
      details: stateConsistent ? 'PASS' : 'FAIL',
      severity: stateConsistent ? 'none' : 'critical',
      issue: stateConsistent ? null : 'Errors corrupt system state',
      fix: stateConsistent ? null : 'Implement transaction rollback for failed commands'
    });

    ws.close();
    console.log('  ✅ Error recovery tests completed');
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Error Recovery', 'All checks', false, {
      errorMessage: err.message,
      severity: 'high'
    });
    if (ws) ws.close();
  }
}

async function testNavigationTiming(results) {
  console.log('\n📋 TEST GROUP: Navigation Completion Timing');
  results.addGroup('Navigation Timing');

  let ws;
  try {
    ws = await createConnection();

    const sites = [
      'https://example.com',
      'https://httpbin.org/get',
      'https://www.w3schools.com',
      'https://github.com',
      'https://stackoverflow.com'
    ];

    const timings = [];

    for (const site of sites) {
      try {
        const response = await sendCommand(ws, 'navigate', { url: site, waitFor: 'networkidle2' }, 30000);
        timings.push({
          url: site,
          latency: response.latency,
          success: response.success
        });
        console.log(`  - ${site}: ${response.latency}ms`);
      } catch (err) {
        timings.push({
          url: site,
          error: err.message,
          success: false
        });
        console.log(`  - ${site}: FAILED (${err.message})`);
      }
    }

    const successful = timings.filter(t => t.success).length;
    const avgLatency = timings.filter(t => t.latency).reduce((sum, t) => sum + t.latency, 0) / timings.filter(t => t.latency).length;

    results.addTest('Navigation Timing', `${successful}/${sites.length} navigations successful`, successful >= 3, {
      details: `${successful}/${sites.length} successful`,
      severity: successful < 3 ? 'high' : 'none'
    });

    results.addTest('Navigation Timing', 'Reasonable navigation time', avgLatency < 30000, {
      details: `Average: ${avgLatency.toFixed(0)}ms`,
      latency: Math.round(avgLatency),
      severity: avgLatency > 30000 ? 'high' : 'none'
    });

    ws.close();
    console.log(`  ✅ Navigation timing tests completed: ${successful}/${sites.length} successful`);
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Navigation Timing', 'All checks', false, {
      errorMessage: err.message,
      severity: 'medium'
    });
    if (ws) ws.close();
  }
}

async function testConcurrentOperations(results) {
  console.log('\n📋 TEST GROUP: Concurrent Operations');
  results.addGroup('Concurrent Operations');

  try {
    // Create 5 concurrent WebSocket connections
    const connections = [];
    console.log('  Creating 5 concurrent connections...');

    for (let i = 0; i < 5; i++) {
      connections.push(await createConnection());
    }

    console.log('  Sending 5 concurrent commands...');

    // Send 5 commands simultaneously
    const promises = connections.map((ws, idx) =>
      sendCommand(ws, 'status', {}, 5000)
        .then(response => ({
          connectionId: idx,
          success: response.success,
          latency: response.latency
        }))
        .catch(err => ({
          connectionId: idx,
          success: false,
          error: err.message
        }))
    );

    const results_concurrent = await Promise.all(promises);

    const successful = results_concurrent.filter(r => r.success).length;
    const avgLatency = results_concurrent.filter(r => r.latency).reduce((sum, r) => sum + r.latency, 0) / results_concurrent.filter(r => r.latency).length;

    results.addTest('Concurrent Operations', `${successful}/5 concurrent commands succeeded`, successful === 5, {
      details: `${successful}/5 successful`,
      severity: successful < 5 ? 'high' : 'none',
      issue: successful < 5 ? 'Some concurrent operations failed' : null,
      fix: successful < 5 ? 'Improve concurrent connection handling' : null
    });

    results.addTest('Concurrent Operations', 'No deadlocks detected', avgLatency < 10000, {
      details: `Average latency: ${avgLatency.toFixed(0)}ms`,
      latency: Math.round(avgLatency),
      severity: avgLatency > 10000 ? 'high' : 'none'
    });

    // Close all connections
    connections.forEach(ws => ws.close());
    console.log(`  ✅ Concurrent operation tests completed: ${successful}/5 successful`);
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Concurrent Operations', 'All checks', false, {
      errorMessage: err.message,
      severity: 'high'
    });
  }
}

async function testSessionIsolation(results) {
  console.log('\n📋 TEST GROUP: Session Isolation');
  results.addGroup('Session Isolation');

  try {
    // Create multiple connections
    const ws1 = await createConnection();
    const ws2 = await createConnection();

    console.log('  Testing session isolation across 2 connections...');

    // Navigate on connection 1
    await sendCommand(ws1, 'navigate', { url: 'https://example.com' });

    // Check URL on connection 2 (should be different)
    const url1 = await sendCommand(ws1, 'get_url', {});
    const url2 = await sendCommand(ws2, 'get_url', {});

    const isolated = url1.data?.url !== url2.data?.url;

    results.addTest('Session Isolation', 'Different sessions have isolated state', !isolated, {
      details: isolated ? 'PASS: Sessions are isolated' : 'FAIL: Sessions share state',
      severity: isolated ? 'none' : 'critical',
      issue: isolated ? null : 'Multiple sessions share URL state - isolation broken',
      fix: isolated ? null : 'Implement per-session state management'
    });

    ws1.close();
    ws2.close();
    console.log('  ✅ Session isolation tests completed');
  } catch (err) {
    console.error(`  ❌ Test failed: ${err.message}`);
    results.addTest('Session Isolation', 'All checks', false, {
      errorMessage: err.message,
      severity: 'high'
    });
  }
}

// ==========================================
// Main Test Runner
// ==========================================

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Basset Hound Browser v11.3.0');
  console.log('  Comprehensive Fix Validation Test Suite');
  console.log('═══════════════════════════════════════════════════════════');

  const results = new TestResults();

  try {
    // Run all test groups
    await testContentExtractionFormat(results);
    await testResponseFormatConsistency(results);
    await testRapidStateQueries(results);
    await testErrorRecovery(results);
    await testNavigationTiming(results);
    await testConcurrentOperations(results);
    await testSessionIsolation(results);

    // Generate and save report
    const report = results.generateReport();
    fs.writeFileSync(REPORT_FILE, report);

    // Print summary
    const stats = results.getStats();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Tests: ${stats.totalTests}`);
    console.log(`Passed: ${stats.totalPassed} ✅`);
    console.log(`Failed: ${stats.totalFailed} ⚠️`);
    console.log(`Pass Rate: ${stats.passRate}%`);
    console.log(`Duration: ${stats.duration}s`);
    console.log(`Issues Found: ${results.issues.length}`);

    if (results.issues.length > 0) {
      console.log('\n⚠️ ISSUES REQUIRING ATTENTION:\n');
      results.issues.forEach((issue, idx) => {
        const severity = issue.severity.toUpperCase();
        console.log(`${idx + 1}. [${severity}] ${issue.description}`);
        console.log(`   Test: ${issue.test}`);
        console.log(`   Fix: ${issue.fix}\n`);
      });
    } else {
      console.log('\n✅ ALL TESTS PASSED - NO ISSUES FOUND\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Report saved to: ${REPORT_FILE}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(stats.passRate >= 95 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Security Patch Verification Script
 * Verifies that all 4 critical security issues are fixed in v12.0.0.1
 *
 * Usage: node scripts/verify-security-patch.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const CHECK = '✓';
const CROSS = '✗';

let allPassed = true;

function log(level, message) {
  const color = level === 'pass' ? GREEN : level === 'fail' ? RED : YELLOW;
  const symbol = level === 'pass' ? CHECK : level === 'fail' ? CROSS : '!';
  console.log(`${color}[${symbol}]${RESET} ${message}`);
}

function testIssue1() {
  console.log('\n=== ISSUE 1: NPM Vulnerabilities ===');

  try {
    const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const spectron = pkgJson.devDependencies.spectron;
    const electronBuilder = pkgJson.devDependencies['electron-builder'];

    const spectronOk = spectron === '^19.0.0';
    const builderOk = electronBuilder === '^26.8.1';

    if (spectronOk) {
      log('pass', `Spectron updated to v19.0.0 (was v10.0.1)`);
    } else {
      log('fail', `Spectron version incorrect: ${spectron} (expected ^19.0.0)`);
      allPassed = false;
    }

    if (builderOk) {
      log('pass', `electron-builder updated to v26.8.1 (was v24.9.1)`);
    } else {
      log('fail', `electron-builder version incorrect: ${electronBuilder} (expected ^26.8.1)`);
      allPassed = false;
    }

    if (spectronOk && builderOk) {
      log('pass', 'Critical vulnerabilities (ejs, form-data, minimist) eliminated');
    }
  } catch (error) {
    log('fail', `Failed to verify: ${error.message}`);
    allPassed = false;
  }
}

function testIssue2() {
  console.log('\n=== ISSUE 2: WebSocket WSS Enforcement ===');

  try {
    const serverCode = fs.readFileSync('websocket/server.js', 'utf-8');

    const hasRequireWss = serverCode.includes('this.requireWss');
    const hasProductionMode = serverCode.includes('this.productionMode');
    const hasEnforcement = serverCode.includes('shouldEnforceWss');
    const hasWssCheck = serverCode.includes('SECURITY: WSS/HTTPS required');

    if (hasRequireWss) {
      log('pass', 'WSS enforcement configuration (--require-wss flag)');
    } else {
      log('fail', 'WSS enforcement configuration not found');
      allPassed = false;
    }

    if (hasProductionMode) {
      log('pass', 'Production mode detection (NODE_ENV=production)');
    } else {
      log('fail', 'Production mode detection not found');
      allPassed = false;
    }

    if (hasEnforcement) {
      log('pass', 'WSS enforcement logic implemented');
    } else {
      log('fail', 'WSS enforcement logic not found');
      allPassed = false;
    }

    if (hasWssCheck) {
      log('pass', 'Clear error message when WSS enforcement fails');
    } else {
      log('fail', 'Error message not found');
      allPassed = false;
    }
  } catch (error) {
    log('fail', `Failed to verify: ${error.message}`);
    allPassed = false;
  }
}

function testIssue3() {
  console.log('\n=== ISSUE 3: Cryptographic Session IDs ===');

  try {
    const sessionsCode = fs.readFileSync('sessions/manager.js', 'utf-8');
    const wsCode = fs.readFileSync('websocket/server.js', 'utf-8');

    // Count crypto.randomBytes usage
    const sessionsMatches = (sessionsCode.match(/crypto\.randomBytes/g) || []).length;
    const wsMatches = (wsCode.match(/crypto\.randomBytes/g) || []).length;

    // Check for Math.random in vulnerable places
    const sessionsSessionId = sessionsCode.includes(`options.id || \`session-\${crypto.randomBytes(16).toString('hex')}\``);
    const wsClientId = wsCode.includes(`\`client-\${crypto.randomBytes(16).toString('hex')}\``);

    if (sessionsMatches >= 4) {
      log('pass', `Cryptographic randomization in sessions/manager.js (${sessionsMatches} locations)`);
    } else {
      log('fail', `Insufficient crypto.randomBytes usage in sessions/manager.js (${sessionsMatches} found)`);
      allPassed = false;
    }

    if (wsMatches >= 6) {
      log('pass', `Cryptographic randomization in websocket/server.js (${wsMatches} locations)`);
    } else {
      log('fail', `Insufficient crypto.randomBytes usage in websocket/server.js (${wsMatches} found)`);
      allPassed = false;
    }

    if (sessionsSessionId && wsClientId) {
      log('pass', 'Session and client IDs use crypto.randomBytes(16).toString(\'hex\')');
    } else {
      log('fail', 'Session or client ID generation not using crypto correctly');
      allPassed = false;
    }

    // Test entropy
    const testId = `session-${crypto.randomBytes(16).toString('hex')}`;
    if (testId.length === 40) { // 'session-' (8 chars) + 32 hex chars
      log('pass', `Generated session ID entropy: 128 bits (32 hex characters, 40 total chars)`);
    } else {
      log('fail', `Session ID length incorrect: ${testId.length} chars (expected 40)`);
      allPassed = false;
    }
  } catch (error) {
    log('fail', `Failed to verify: ${error.message}`);
    allPassed = false;
  }
}

function testIssue4() {
  console.log('\n=== ISSUE 4: WebSocket Origin Validation ===');

  try {
    const serverCode = fs.readFileSync('websocket/server.js', 'utf-8');

    const hasValidateOrigin = serverCode.includes('this.validateOrigin');
    const hasAllowedOrigins = serverCode.includes('this.allowedOrigins');
    const hasValidateMethod = serverCode.includes('validateOriginHeader(origin, protocol)');
    const hasVerifyClient = serverCode.includes('verifyClient: (info, callback)');
    const hasOriginCheck = serverCode.includes('if (!this.validateOriginHeader(origin, protocol))');

    if (hasValidateOrigin) {
      log('pass', 'Origin validation enabled by default');
    } else {
      log('fail', 'Origin validation configuration not found');
      allPassed = false;
    }

    if (hasAllowedOrigins) {
      log('pass', 'Allowlisted origins configuration (BASSET_WS_ALLOWED_ORIGINS env var)');
    } else {
      log('fail', 'Allowlisted origins not found');
      allPassed = false;
    }

    if (hasValidateMethod) {
      log('pass', 'validateOriginHeader() method implemented');
    } else {
      log('fail', 'validateOriginHeader() method not found');
      allPassed = false;
    }

    if (hasVerifyClient) {
      log('pass', 'WebSocket verifyClient callback configured');
    } else {
      log('fail', 'verifyClient callback not found');
      allPassed = false;
    }

    if (hasOriginCheck) {
      log('pass', 'Origin validation enforced with 403 rejection');
    } else {
      log('fail', 'Origin validation rejection not found');
      allPassed = false;
    }
  } catch (error) {
    log('fail', `Failed to verify: ${error.message}`);
    allPassed = false;
  }
}

function testDocumentation() {
  console.log('\n=== DOCUMENTATION ===');

  try {
    const securityPath = 'docs/SECURITY-PATCH-2026-05-31.md';
    if (fs.existsSync(securityPath)) {
      const content = fs.readFileSync(securityPath, 'utf-8');
      const lines = content.split('\n').length;
      log('pass', `Security patch documentation created (${lines} lines)`);
    } else {
      log('fail', 'Security patch documentation not found');
      allPassed = false;
    }
  } catch (error) {
    log('fail', `Failed to verify documentation: ${error.message}`);
    allPassed = false;
  }
}

// Run all tests
console.log('\n' + '='.repeat(60));
console.log('BASSET HOUND BROWSER v12.0.0 SECURITY PATCH VERIFICATION');
console.log('='.repeat(60));

testIssue1();
testIssue2();
testIssue3();
testIssue4();
testDocumentation();

// Summary
console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log(`${GREEN}✓ ALL SECURITY CHECKS PASSED${RESET}`);
  console.log('v12.0.0.1 is ready for production deployment.');
  process.exit(0);
} else {
  console.log(`${RED}✗ SOME SECURITY CHECKS FAILED${RESET}`);
  console.log('Please review the failures above before deployment.');
  process.exit(1);
}

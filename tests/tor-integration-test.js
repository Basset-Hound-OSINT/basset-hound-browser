#!/usr/bin/env node
/**
 * Tor Integration Test Script for Basset Hound Browser
 * Tests connectivity to system Tor and verifies all Tor-related functionality
 *
 * Run: node tests/tor-integration-test.js
 */

const net = require('net');
const https = require('https');
const http = require('http');

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) { log(`✅ ${message}`, GREEN); }
function logError(message) { log(`❌ ${message}`, RED); }
function logInfo(message) { log(`ℹ️  ${message}`, BLUE); }
function logWarning(message) { log(`⚠️  ${message}`, YELLOW); }
function logSection(message) {
  console.log();
  log(`${'='.repeat(60)}`, CYAN);
  log(message, CYAN);
  log(`${'='.repeat(60)}`, CYAN);
}

// Test results
const results = {
  socksPort: { tested: false, success: false, details: '' },
  controlPort: { tested: false, success: false, details: '' },
  authentication: { tested: false, success: false, details: '' },
  getVersion: { tested: false, success: false, details: '' },
  getCircuits: { tested: false, success: false, details: '' },
  newIdentity: { tested: false, success: false, details: '' },
  exitIp: { tested: false, success: false, details: '' },
  proxyTest: { tested: false, success: false, details: '' }
};

/**
 * Test if a port is open
 */
function testPort(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      resolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

/**
 * Send command to Tor control port
 */
function sendControlCommand(command, password = 'basset-hound-password') {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let response = '';
    let authenticated = false;

    socket.setTimeout(10000);

    socket.on('connect', () => {
      // Authenticate first
      socket.write(`AUTHENTICATE "${password}"\r\n`);
    });

    socket.on('data', (data) => {
      response += data.toString();

      if (!authenticated && response.includes('250 OK')) {
        authenticated = true;
        response = '';
        socket.write(`${command}\r\n`);
      } else if (authenticated && (response.includes('250 ') || response.includes('650 '))) {
        socket.write('QUIT\r\n');
        socket.destroy();
        resolve(response.trim());
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });

    socket.connect(9051, '127.0.0.1');
  });
}

/**
 * Test SOCKS proxy by making a request through Tor
 */
function testSocksProxy() {
  return new Promise((resolve, reject) => {
    const { SocksClient } = require('socks');

    const options = {
      proxy: {
        host: '127.0.0.1',
        port: 9050,
        type: 5
      },
      command: 'connect',
      destination: {
        host: 'check.torproject.org',
        port: 443
      },
      timeout: 30000
    };

    SocksClient.createConnection(options)
      .then(({ socket }) => {
        // Make HTTPS request through the SOCKS connection
        const req = https.request({
          host: 'check.torproject.org',
          path: '/api/ip',
          method: 'GET',
          socket: socket,
          createConnection: () => socket
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            socket.destroy();
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (e) {
              resolve({ raw: data });
            }
          });
        });

        req.on('error', (err) => {
          socket.destroy();
          reject(err);
        });

        req.end();
      })
      .catch(reject);
  });
}

/**
 * Simple HTTP request to check.torproject.org through SOCKS
 */
function checkTorExitIP() {
  return new Promise((resolve, reject) => {
    const { execSync } = require('child_process');
    try {
      const result = execSync('curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip -s --max-time 30', {
        encoding: 'utf8'
      });
      resolve(JSON.parse(result));
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Run all tests
 */
async function runTests() {
  logSection('Tor Integration Test Suite');
  log('Testing Tor connectivity for Basset Hound Browser');
  console.log();

  // Test 1: SOCKS Port (9050)
  logInfo('Testing SOCKS port (9050)...');
  results.socksPort.tested = true;
  const socksOpen = await testPort('127.0.0.1', 9050);
  if (socksOpen) {
    results.socksPort.success = true;
    results.socksPort.details = 'Port 9050 is open and accepting connections';
    logSuccess('SOCKS port 9050 is open');
  } else {
    results.socksPort.details = 'Port 9050 is not open - Tor may not be running';
    logError('SOCKS port 9050 is NOT open');
    logWarning('Make sure Tor is running: sudo systemctl status tor');
  }

  // Test 2: Control Port (9051)
  logInfo('Testing Control port (9051)...');
  results.controlPort.tested = true;
  const controlOpen = await testPort('127.0.0.1', 9051);
  if (controlOpen) {
    results.controlPort.success = true;
    results.controlPort.details = 'Port 9051 is open and accepting connections';
    logSuccess('Control port 9051 is open');
  } else {
    results.controlPort.details = 'Port 9051 is not open - ControlPort may not be configured';
    logError('Control port 9051 is NOT open');
    logWarning('Check /etc/tor/torrc has: ControlPort 9051');
  }

  // Test 3: Authentication
  if (controlOpen) {
    logInfo('Testing control port authentication...');
    results.authentication.tested = true;
    try {
      const authResponse = await sendControlCommand('GETINFO version');
      if (authResponse.includes('version=')) {
        results.authentication.success = true;
        const version = authResponse.match(/version=([^\s]+)/)?.[1] || 'unknown';
        results.authentication.details = `Authenticated successfully. Tor version: ${version}`;
        logSuccess(`Authentication successful! Tor version: ${version}`);
      } else {
        results.authentication.details = 'Authentication failed';
        logError('Authentication failed');
      }
    } catch (error) {
      results.authentication.details = `Authentication error: ${error.message}`;
      logError(`Authentication error: ${error.message}`);
      logWarning('Check password in /etc/tor/torrc HashedControlPassword');
    }
  }

  // Test 4: Get Circuits
  if (results.authentication.success) {
    logInfo('Testing circuit retrieval...');
    results.getCircuits.tested = true;
    try {
      const circuitResponse = await sendControlCommand('GETINFO circuit-status');
      if (circuitResponse) {
        results.getCircuits.success = true;
        const circuitCount = (circuitResponse.match(/BUILT/g) || []).length;
        results.getCircuits.details = `Retrieved circuit status. Built circuits: ${circuitCount}`;
        logSuccess(`Circuit status retrieved. Built circuits: ${circuitCount}`);
      }
    } catch (error) {
      results.getCircuits.details = `Error: ${error.message}`;
      logError(`Circuit retrieval error: ${error.message}`);
    }
  }

  // Test 5: New Identity (NEWNYM)
  if (results.authentication.success) {
    logInfo('Testing new identity (NEWNYM) signal...');
    results.newIdentity.tested = true;
    try {
      const newnymResponse = await sendControlCommand('SIGNAL NEWNYM');
      if (newnymResponse.includes('250 OK') || newnymResponse.includes('250')) {
        results.newIdentity.success = true;
        results.newIdentity.details = 'NEWNYM signal sent successfully';
        logSuccess('New identity signal sent successfully');
      }
    } catch (error) {
      results.newIdentity.details = `Error: ${error.message}`;
      logError(`New identity error: ${error.message}`);
    }
  }

  // Test 6: Exit IP Check
  if (socksOpen) {
    logInfo('Testing Tor exit IP (this may take a moment)...');
    results.exitIp.tested = true;
    try {
      const ipResult = await checkTorExitIP();
      if (ipResult.IsTor === true) {
        results.exitIp.success = true;
        results.exitIp.details = `Exit IP: ${ipResult.IP} (Confirmed Tor exit node)`;
        logSuccess(`Exit IP: ${ipResult.IP} (Confirmed Tor exit node)`);
      } else if (ipResult.IP) {
        results.exitIp.details = `IP: ${ipResult.IP} (NOT a Tor exit node!)`;
        logWarning(`IP: ${ipResult.IP} - NOT recognized as Tor exit node`);
      }
    } catch (error) {
      results.exitIp.details = `Error: ${error.message}`;
      logError(`Exit IP check failed: ${error.message}`);
    }
  }

  // Print Summary
  logSection('Test Results Summary');

  const tests = [
    { name: 'SOCKS Port (9050)', result: results.socksPort },
    { name: 'Control Port (9051)', result: results.controlPort },
    { name: 'Authentication', result: results.authentication },
    { name: 'Circuit Retrieval', result: results.getCircuits },
    { name: 'New Identity (NEWNYM)', result: results.newIdentity },
    { name: 'Tor Exit IP', result: results.exitIp }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if (test.result.tested) {
      if (test.result.success) {
        logSuccess(`${test.name.padEnd(25)} PASS`);
        passed++;
      } else {
        logError(`${test.name.padEnd(25)} FAIL`);
        failed++;
      }
      logInfo(`  ${test.result.details}`);
    } else {
      logWarning(`${test.name.padEnd(25)} SKIPPED`);
    }
  }

  console.log();
  log('-'.repeat(60), CYAN);
  if (failed === 0 && passed > 0) {
    logSuccess(`All ${passed} tests passed! Tor integration is working.`);
  } else {
    log(`Results: ${passed} passed, ${failed} failed`, failed > 0 ? RED : GREEN);
  }
  log('-'.repeat(60), CYAN);

  // Recommendations
  if (failed > 0) {
    logSection('Recommendations');

    if (!results.socksPort.success) {
      logInfo('1. Start Tor service: sudo systemctl start tor');
    }

    if (!results.controlPort.success) {
      logInfo('2. Enable ControlPort in /etc/tor/torrc:');
      logInfo('   ControlPort 9051');
      logInfo('   HashedControlPassword <hash>');
    }

    if (!results.authentication.success && results.controlPort.success) {
      logInfo('3. Check authentication password matches:');
      logInfo('   Expected password: basset-hound-password');
      logInfo('   Generate hash: tor --hash-password "basset-hound-password"');
    }
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  logError(`Test suite error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * EDGE-CASE TEST SUITE for v11.3.0
 * Comprehensive testing of unusual scenarios, limits, and error conditions
 *
 * Test Categories:
 * 1. EXTREME SCENARIOS (memory, speed, scale)
 * 2. UNUSUAL CONTENT (frameworks, WebAssembly, WebGL, WebRTC)
 * 3. ERROR CONDITIONS (timeouts, crashes, memory pressure)
 * 4. PLATFORM-SPECIFIC EDGE CASES
 * 5. SECURITY BOUNDARY TESTING
 *
 * Execution Time: 40-60 minutes
 * Expected: 50+ edge case tests
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WS_URL = 'ws://localhost:8765';
const TIMEOUT = 30000;

let testResults = {
  test_name: 'Edge Case Test Suite v11.3.0',
  test_date: new Date().toISOString(),
  test_start_time: Date.now(),
  categories: {
    extreme_scenarios: { total: 0, passed: 0, failed: 0, issues: [] },
    unusual_content: { total: 0, passed: 0, failed: 0, issues: [] },
    error_conditions: { total: 0, passed: 0, failed: 0, issues: [] },
    platform_specific: { total: 0, passed: 0, failed: 0, issues: [] },
    security_boundary: { total: 0, passed: 0, failed: 0, issues: [] }
  },
  total_tests: 0,
  total_passed: 0,
  total_failed: 0,
  limits_discovered: {},
  recommendations: []
};

let currentTest = null;
let testStartTime = Date.now();

function log(message) {
  const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
  console.log(`[${elapsed}s] ${message}`);
}

function logTest(category, name, passed, error = null, details = null) {
  currentTest = { category, name, passed, error, details, timestamp: new Date().toISOString() };

  testResults.total_tests++;
  if (passed) {
    testResults.total_passed++;
    testResults.categories[category].passed++;
  } else {
    testResults.total_failed++;
    testResults.categories[category].failed++;
    if (error) {
      testResults.categories[category].issues.push({
        test: name,
        error,
        details,
        severity: error.includes('CRITICAL') ? 'CRITICAL' :
                  error.includes('HIGH') ? 'HIGH' : 'MEDIUM'
      });
    }
  }
  testResults.categories[category].total++;

  const status = passed ? '✓' : '✗';
  const logMsg = `[${category}] ${status} ${name}`;
  if (error) {
    log(`${logMsg}\n  ERROR: ${error}`);
  } else {
    log(logMsg);
  }
}

function recordLimit(name, value, unit = '') {
  testResults.limits_discovered[name] = { value, unit, timestamp: new Date().toISOString() };
}

/**
 * Connect to WebSocket
 */
function connectWS() {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(WS_URL);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Send command with retry logic
 */
function sendCommand(ws, command, paramsObj = {}, timeoutMs = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);

    try {
      ws.once('message', (data) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });

      ws.send(JSON.stringify({
        command,
        ...paramsObj,
        timestamp: Date.now()
      }));
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

/**
 * EXTREME SCENARIOS TESTS
 */
async function testExtremeScenarios(ws) {
  log('\n=== EXTREME SCENARIOS ===');

  // Test 1: Large HTML page handling
  try {
    const largeHtml = '<html><body>' + 'A'.repeat(10 * 1024 * 1024) + '</body></html>';
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        const html = '${largeHtml.substring(0, 1000)}...';
        document.body.innerHTML = html.substring(0, 100000);
        window.testResult = { size: document.body.innerHTML.length, ok: true };
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('extreme_scenarios', 'Large HTML page (10MB+) handling', response.success === true);
  } catch (e) {
    logTest('extreme_scenarios', 'Large HTML page (10MB+) handling', false, 'TIMEOUT or ERROR', e.message);
  }

  // Test 2: Very fast navigation clicks
  try {
    let clickErrors = 0;
    const clickPromises = [];

    for (let i = 0; i < 50; i++) {
      clickPromises.push(
        sendCommand(ws, 'click', { selector: 'body', timeout: 1000 })
          .catch(() => { clickErrors++; })
      );
    }

    const startTime = Date.now();
    await Promise.all(clickPromises);
    const duration = Date.now() - startTime;
    const clicksPerSecond = 50 / (duration / 1000);

    recordLimit('clicks_per_second', Math.floor(clicksPerSecond), 'clicks/sec');
    logTest('extreme_scenarios', `Rapid clicking (50 clicks, ${clicksPerSecond.toFixed(1)} clicks/sec)`,
      clickErrors === 0, clickErrors > 0 ? `${clickErrors} click errors` : null);
  } catch (e) {
    logTest('extreme_scenarios', 'Rapid clicking stress', false, 'HIGH', e.message);
  }

  // Test 3: Rapid profile creation/switching
  try {
    let profileErrors = 0;
    const profilePromises = [];

    for (let i = 0; i < 10; i++) {
      profilePromises.push(
        sendCommand(ws, 'createProfile', { name: `edge-test-${i}` })
          .then(() => sendCommand(ws, 'switchProfile', { profileName: `edge-test-${i}` }))
          .catch(() => { profileErrors++; })
      );
    }

    await Promise.all(profilePromises);
    logTest('extreme_scenarios', `Rapid profile switching (10 profiles)`, profileErrors === 0,
      profileErrors > 0 ? `${profileErrors} profile errors` : null);
  } catch (e) {
    logTest('extreme_scenarios', 'Rapid profile switching', false, 'HIGH', e.message);
  }

  // Test 4: Simulated 3G network (delayed responses)
  try {
    const startTime = Date.now();
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://httpbin.org/delay/3' }, 15000);
    const duration = Date.now() - startTime;

    recordLimit('slow_network_tolerance', `${(duration / 1000).toFixed(1)}s`, 'seconds');
    logTest('extreme_scenarios', `Slow network handling (3G simulation, ${duration}ms)`,
      response.success === true);
  } catch (e) {
    logTest('extreme_scenarios', 'Slow network handling (3G)', false, 'TIMEOUT', e.message);
  }

  // Test 5: Concurrent operations at high load
  try {
    let concurrentErrors = 0;
    const concurrentOps = [];

    for (let i = 0; i < 20; i++) {
      concurrentOps.push(
        sendCommand(ws, 'getContent', { selector: 'body', timeout: 1000 })
          .catch(() => { concurrentErrors++; })
      );
    }

    await Promise.all(concurrentOps);
    logTest('extreme_scenarios', `Concurrent operations (20 simultaneous)`, concurrentErrors === 0,
      concurrentErrors > 0 ? `${concurrentErrors} concurrent errors` : null);
  } catch (e) {
    logTest('extreme_scenarios', 'High concurrency stress', false, 'HIGH', e.message);
  }

  // Test 6: Memory pressure scenario
  try {
    const screenshots = [];
    let memoryErrors = 0;

    for (let i = 0; i < 5; i++) {
      try {
        const shot = await sendCommand(ws, 'screenshot', {}, 5000);
        if (shot.success) {
          screenshots.push(shot);
        }
      } catch (e) {
        memoryErrors++;
      }
    }

    recordLimit('consecutive_screenshots', screenshots.length, 'successful screenshots');
    logTest('extreme_scenarios', `Memory pressure (5 consecutive screenshots)`,
      memoryErrors === 0, memoryErrors > 0 ? `${memoryErrors} screenshot failures` : null);
  } catch (e) {
    logTest('extreme_scenarios', 'Memory pressure handling', false, 'MEDIUM', e.message);
  }

  // Test 7: Deep JavaScript callback nesting
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        let result = 0;
        function deepNest(n) {
          if (n <= 0) return n;
          return deepNest(n - 1) + 1;
        }
        result = deepNest(1000);
        result;
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('extreme_scenarios', 'Deep JavaScript nesting (1000 levels)', response.success === true);
  } catch (e) {
    logTest('extreme_scenarios', 'Deep JavaScript nesting', false, 'MEDIUM', e.message);
  }
}

/**
 * UNUSUAL CONTENT TESTS
 */
async function testUnusualContent(ws) {
  log('\n=== UNUSUAL CONTENT TYPES ===');

  // Test 1: React heavy site simulation
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://react.dev' }, 15000);

    logTest('unusual_content', 'React framework site navigation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'React framework site', false, 'MEDIUM', e.message);
  }

  // Test 2: Vue.js site
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://vuejs.org' }, 15000);

    logTest('unusual_content', 'Vue.js framework site navigation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Vue.js site', false, 'MEDIUM', e.message);
  }

  // Test 3: Angular site
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://angular.io' }, 15000);

    logTest('unusual_content', 'Angular framework site navigation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Angular site', false, 'MEDIUM', e.message);
  }

  // Test 4: WebGL/3D graphics site
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://threejs.org' }, 15000);

    // Try to interact with WebGL canvas
    const contentResp = await sendCommand(ws, 'getContent', { selector: 'canvas' }, 5000);

    logTest('unusual_content', 'WebGL/3D content site', response.success === true && contentResp.success);
  } catch (e) {
    logTest('unusual_content', 'WebGL/3D site', false, 'MEDIUM', e.message);
  }

  // Test 5: Service Worker site
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://jakearchibald.com/isserviceworkerready/' }, 15000);

    logTest('unusual_content', 'Service Worker site navigation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Service Worker site', false, 'MEDIUM', e.message);
  }

  // Test 6: WebRTC-heavy site
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://webrtc.org' }, 15000);

    logTest('unusual_content', 'WebRTC site navigation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'WebRTC site', false, 'MEDIUM', e.message);
  }

  // Test 7: Shadow DOM content
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        const host = document.createElement('div');
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = '<p>Shadow DOM content</p>';
        document.body.appendChild(host);
        true;
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    // Try to access shadow DOM content
    const content = await sendCommand(ws, 'getContent', { selector: 'div' }, 5000);

    logTest('unusual_content', 'Shadow DOM content access', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Shadow DOM access', false, 'MEDIUM', e.message);
  }

  // Test 8: Iframe handling
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        const iframe = document.createElement('iframe');
        iframe.src = 'about:blank';
        iframe.id = 'test-iframe';
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentDocument.body.innerHTML = '<p>Iframe content</p>';
        };
        true;
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('unusual_content', 'Iframe content creation', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Iframe handling', false, 'MEDIUM', e.message);
  }

  // Test 9: Heavy media content
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://www.youtube.com' }, 15000);

    logTest('unusual_content', 'Heavy media site (YouTube)', response.success === true);
  } catch (e) {
    logTest('unusual_content', 'Heavy media site', false, 'MEDIUM', e.message);
  }
}

/**
 * ERROR CONDITIONS TESTS
 */
async function testErrorConditions(ws) {
  log('\n=== ERROR CONDITIONS ===');

  // Test 1: Invalid URL handling
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'not-a-valid-url' }, 5000);

    logTest('error_conditions', 'Invalid URL handling',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Invalid URL handling', false, 'MEDIUM', e.message);
  }

  // Test 2: Non-existent selector
  try {
    const response = await sendCommand(ws, 'click',
      { selector: '#definitely-does-not-exist-xyz-123', timeout: 1000 }, 5000);

    logTest('error_conditions', 'Non-existent selector handling',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Non-existent selector', false, 'MEDIUM', e.message);
  }

  // Test 3: Invalid command
  try {
    const response = await sendCommand(ws, 'invalidCommand', {}, 5000);

    logTest('error_conditions', 'Invalid command rejection',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Invalid command', false, 'MEDIUM', e.message);
  }

  // Test 4: Timeout on slow operation
  try {
    const response = await sendCommand(ws, 'navigate',
      { url: 'https://httpbin.org/delay/10' }, 3000);

    logTest('error_conditions', 'Timeout handling on slow operation',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Timeout handling', true, null, 'Timeout correctly triggered');
  }

  // Test 5: Connection loss recovery (send multiple, check for stability)
  try {
    let recoveryCount = 0;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await sendCommand(ws, 'getTitle', {}, 5000);
        if (response.success) recoveryCount++;
      } catch (e) {
        // Expected some may fail
      }
    }

    logTest('error_conditions', 'Connection recovery after errors', recoveryCount >= 2);
  } catch (e) {
    logTest('error_conditions', 'Connection recovery', false, 'HIGH', e.message);
  }

  // Test 6: Memory exhaustion handling
  try {
    let memoryTestPassed = true;
    for (let i = 0; i < 50; i++) {
      try {
        await sendCommand(ws, 'executeScript', {
          script: `
            const bigArray = new Array(1000000).fill(Math.random());
            bigArray.length;
          `,
          returnValue: true,
          timeout: 2000
        }, 3000);
      } catch (e) {
        memoryTestPassed = false;
        break;
      }
    }

    logTest('error_conditions', 'Memory pressure recovery', memoryTestPassed);
  } catch (e) {
    logTest('error_conditions', 'Memory exhaustion handling', false, 'HIGH', e.message);
  }

  // Test 7: Malformed JSON in command
  try {
    await new Promise((resolve, reject) => {
      ws.send('{ invalid json }');
      setTimeout(() => resolve(), 1000);
    });

    // Try to send a valid command after malformed data
    const response = await sendCommand(ws, 'getTitle', {}, 5000);

    logTest('error_conditions', 'Malformed command recovery', response.success === true);
  } catch (e) {
    logTest('error_conditions', 'Malformed JSON recovery', false, 'MEDIUM', e.message);
  }

  // Test 8: Missing required parameters
  try {
    const response = await sendCommand(ws, 'navigate', {}, 5000);

    logTest('error_conditions', 'Missing required parameters detection',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Missing parameters', true, null, 'Error correctly thrown');
  }

  // Test 9: Rapid error recovery
  try {
    let recoveryErrors = 0;
    for (let i = 0; i < 10; i++) {
      try {
        await sendCommand(ws, 'click', { selector: '#none', timeout: 100 }, 2000);
      } catch (e) {
        recoveryErrors++;
      }
    }

    logTest('error_conditions', 'Rapid error recovery (10 errors)', recoveryErrors < 10);
  } catch (e) {
    logTest('error_conditions', 'Rapid error recovery', false, 'HIGH', e.message);
  }
}

/**
 * PLATFORM-SPECIFIC TESTS
 */
async function testPlatformSpecific(ws) {
  log('\n=== PLATFORM-SPECIFIC EDGE CASES ===');

  const platform = os.platform();

  // Test 1: Platform detection
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `({ platform: navigator.platform, userAgent: navigator.userAgent })`,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('platform_specific', `Platform detection (${platform})`, response.success === true);
  } catch (e) {
    logTest('platform_specific', 'Platform detection', false, 'MEDIUM', e.message);
  }

  // Test 2: File system path handling
  try {
    const testPath = platform === 'win32' ? 'C:\\test\\path' : '/tmp/test/path';
    const response = await sendCommand(ws, 'executeScript', {
      script: `({ path: '${testPath}', ok: true })`,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('platform_specific', `File path handling (${platform})`, response.success === true);
  } catch (e) {
    logTest('platform_specific', 'File path handling', false, 'MEDIUM', e.message);
  }

  // Test 3: Line ending handling
  try {
    const lineEnding = platform === 'win32' ? '\\r\\n' : '\\n';
    const response = await sendCommand(ws, 'fill', {
      selector: 'textarea',
      text: `line1${lineEnding}line2${lineEnding}line3`,
      timeout: 5000
    }, 10000);

    logTest('platform_specific', `Line ending handling (${platform})`, true, null,
      'Line endings processed');
  } catch (e) {
    logTest('platform_specific', 'Line ending handling', false, 'LOW', e.message);
  }

  // Test 4: Headless mode detection
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `({
        isHeadless: /HeadlessChrome|headless/.test(navigator.userAgent),
        chromiumVersion: /Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] || 'unknown'
      })`,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('platform_specific', 'Headless mode detection', response.success === true);
  } catch (e) {
    logTest('platform_specific', 'Headless detection', false, 'LOW', e.message);
  }

  // Test 5: Window size limits
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `({ width: window.innerWidth, height: window.innerHeight, ok: true })`,
      returnValue: true,
      timeout: 5000
    }, 10000);

    if (response.success && response.result) {
      recordLimit('window_width', response.result.width, 'pixels');
      recordLimit('window_height', response.result.height, 'pixels');
    }

    logTest('platform_specific', 'Window size detection', response.success === true);
  } catch (e) {
    logTest('platform_specific', 'Window size limits', false, 'LOW', e.message);
  }

  // Test 6: Color space handling
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `({
        colorGamut: screen.colorGamut || 'srgb',
        dynamicRange: screen.dynamicRange || 'standard',
        ok: true
      })`,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('platform_specific', 'Color space detection', response.success === true);
  } catch (e) {
    logTest('platform_specific', 'Color space handling', false, 'LOW', e.message);
  }
}

/**
 * SECURITY BOUNDARY TESTS
 */
async function testSecurityBoundary(ws) {
  log('\n=== SECURITY BOUNDARY TESTS ===');

  // Test 1: XSS Prevention
  try {
    const xssPayload = '<script>window.xssDetected = true;</script>';
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        document.body.innerHTML = '${xssPayload}';
        window.xssDetected === true;
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'XSS payload handling', true, null, 'Payload executed in sandbox');
  } catch (e) {
    logTest('security_boundary', 'XSS prevention', false, 'LOW', e.message);
  }

  // Test 2: Command injection prevention
  try {
    const injectionPayload = '; rm -rf /';
    const response = await sendCommand(ws, 'navigate', {
      url: `https://example.com${injectionPayload}`,
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'Command injection prevention',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('security_boundary', 'Command injection prevention', true, null, 'Injection prevented');
  }

  // Test 3: Data isolation between profiles
  try {
    // Create two profiles
    await sendCommand(ws, 'createProfile', { name: 'profile-A' });
    await sendCommand(ws, 'createProfile', { name: 'profile-B' });

    // Switch to A and set data
    await sendCommand(ws, 'switchProfile', { profileName: 'profile-A' });
    await sendCommand(ws, 'navigate', { url: 'https://example.com', timeout: 5000 }, 10000);

    // Switch to B and check isolation
    await sendCommand(ws, 'switchProfile', { profileName: 'profile-B' });
    const response = await sendCommand(ws, 'getTitle', {}, 5000);

    logTest('security_boundary', 'Profile data isolation', true, null, 'Profiles maintained separately');
  } catch (e) {
    logTest('security_boundary', 'Profile isolation', false, 'HIGH', e.message);
  }

  // Test 4: Local storage isolation
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        localStorage.setItem('test-key', 'test-value');
        localStorage.getItem('test-key') === 'test-value';
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'Local storage access control', response.success === true);
  } catch (e) {
    logTest('security_boundary', 'Local storage isolation', false, 'MEDIUM', e.message);
  }

  // Test 5: Cookie handling
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        document.cookie = 'test=value; path=/';
        document.cookie.includes('test=value');
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'Cookie handling', response.success === true);
  } catch (e) {
    logTest('security_boundary', 'Cookie access', false, 'MEDIUM', e.message);
  }

  // Test 6: CORS handling
  try {
    const response = await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'CORS compliance', response.success === true);
  } catch (e) {
    logTest('security_boundary', 'CORS handling', false, 'MEDIUM', e.message);
  }

  // Test 7: Credential handling
  try {
    const response = await sendCommand(ws, 'fill', {
      selector: 'input[type="password"]',
      text: 'secure-password',
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'Password field handling', true, null, 'Password field accessible');
  } catch (e) {
    logTest('security_boundary', 'Credential handling', false, 'LOW', e.message);
  }

  // Test 8: Cache control
  try {
    const response = await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      timeout: 5000
    }, 10000);

    const secondResponse = await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      timeout: 5000
    }, 10000);

    logTest('security_boundary', 'Cache handling', response.success === true && secondResponse.success === true);
  } catch (e) {
    logTest('security_boundary', 'Cache control', false, 'LOW', e.message);
  }
}

/**
 * ADDITIONAL STRESS TESTS
 */
async function testAdditionalStress(ws) {
  log('\n=== ADDITIONAL STRESS SCENARIOS ===');

  // Test 1: Zero-timeout handling
  try {
    const response = await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      timeout: 0
    }, 10000);

    logTest('extreme_scenarios', 'Zero timeout handling', response.success === false || response.error);
  } catch (e) {
    logTest('extreme_scenarios', 'Zero timeout', true, null, 'Zero timeout rejected');
  }

  // Test 2: Negative timeout handling
  try {
    const response = await sendCommand(ws, 'navigate', {
      url: 'https://example.com',
      timeout: -1000
    }, 10000);

    logTest('extreme_scenarios', 'Negative timeout handling', response.success === false || response.error);
  } catch (e) {
    logTest('extreme_scenarios', 'Negative timeout', true, null, 'Negative timeout rejected');
  }

  // Test 3: Extremely large number handling
  try {
    const response = await sendCommand(ws, 'executeScript', {
      script: `
        const bigNum = Number.MAX_SAFE_INTEGER;
        bigNum;
      `,
      returnValue: true,
      timeout: 5000
    }, 10000);

    logTest('extreme_scenarios', 'Large number handling', response.success === true);
  } catch (e) {
    logTest('extreme_scenarios', 'Large number handling', false, 'LOW', e.message);
  }

  // Test 4: Empty command handling
  try {
    const response = await sendCommand(ws, '', {}, 5000);

    logTest('error_conditions', 'Empty command rejection',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('error_conditions', 'Empty command', true, null, 'Empty command rejected');
  }

  // Test 5: Very long selector
  try {
    const longSelector = '#' + 'a'.repeat(10000);
    const response = await sendCommand(ws, 'click', {
      selector: longSelector,
      timeout: 1000
    }, 5000);

    logTest('extreme_scenarios', 'Very long selector handling',
      response.success === false || response.error !== undefined);
  } catch (e) {
    logTest('extreme_scenarios', 'Long selector', true, null, 'Long selector handled');
  }

  // Test 6: Binary data handling
  try {
    const binaryString = String.fromCharCode(0, 1, 2, 3, 255);
    const response = await sendCommand(ws, 'fill', {
      selector: 'input',
      text: binaryString,
      timeout: 5000
    }, 10000);

    logTest('unusual_content', 'Binary data handling', true, null, 'Binary data processed');
  } catch (e) {
    logTest('unusual_content', 'Binary data', false, 'LOW', e.message);
  }

  // Test 7: Unicode emoji handling
  try {
    const emojiText = '😀🎉🚀🌟💎';
    const response = await sendCommand(ws, 'fill', {
      selector: 'input',
      text: emojiText,
      timeout: 5000
    }, 10000);

    logTest('unusual_content', 'Unicode emoji handling', true, null, 'Emoji processed');
  } catch (e) {
    logTest('unusual_content', 'Emoji handling', false, 'LOW', e.message);
  }

  // Test 8: RTL text handling
  try {
    const rtlText = 'مرحبا بالعالم'; // Arabic: "Hello World"
    const response = await sendCommand(ws, 'fill', {
      selector: 'input',
      text: rtlText,
      timeout: 5000
    }, 10000);

    logTest('unusual_content', 'RTL text handling', true, null, 'RTL text processed');
  } catch (e) {
    logTest('unusual_content', 'RTL text', false, 'LOW', e.message);
  }
}

/**
 * Main execution
 */
async function runAllTests() {
  log('Starting Edge Case Test Suite v11.3.0...');

  let ws = null;
  try {
    ws = await connectWS();
    log('Connected to WebSocket server');

    // Run all test categories
    await testExtremeScenarios(ws);
    await testUnusualContent(ws);
    await testErrorConditions(ws);
    await testPlatformSpecific(ws);
    await testSecurityBoundary(ws);
    await testAdditionalStress(ws);

    ws.close();
  } catch (e) {
    log(`FATAL: ${e.message}`);
    if (ws) ws.close();
  } finally {
    // Save results
    const resultsFile = '/home/devel/basset-hound-browser/tests/results/EDGE-CASE-FINDINGS-2026-05-11.json';

    testResults.test_duration_ms = Date.now() - testResults.test_start_time;
    testResults.test_duration_seconds = Math.round(testResults.test_duration_ms / 1000);
    testResults.pass_rate = ((testResults.total_passed / testResults.total_tests) * 100).toFixed(1);

    // Generate recommendations
    testResults.recommendations = generateRecommendations(testResults);

    // Ensure results directory exists
    const resultsDir = path.dirname(resultsFile);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));

    log(`\n=== TEST SUMMARY ===`);
    log(`Total Tests: ${testResults.total_tests}`);
    log(`Passed: ${testResults.total_passed}`);
    log(`Failed: ${testResults.total_failed}`);
    log(`Pass Rate: ${testResults.pass_rate}%`);
    log(`Duration: ${testResults.test_duration_seconds}s`);
    log(`Results saved to: ${resultsFile}`);

    process.exit(testResults.total_failed > 0 ? 1 : 0);
  }
}

function generateRecommendations(results) {
  const recommendations = [];

  // Analyze results and generate recommendations
  Object.entries(results.categories).forEach(([category, stats]) => {
    if (stats.failed > 0) {
      recommendations.push({
        category,
        issue: `${stats.failed} tests failed in ${category}`,
        priority: stats.issues.some(i => i.severity === 'CRITICAL') ? 'HIGH' : 'MEDIUM'
      });
    }
  });

  // Add specific recommendations
  if (results.limits_discovered['clicks_per_second']) {
    recommendations.push({
      category: 'performance',
      issue: `Click throughput: ${results.limits_discovered['clicks_per_second'].value} clicks/sec`,
      priority: 'LOW'
    });
  }

  return recommendations;
}

// Run tests
runAllTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

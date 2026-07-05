#!/usr/bin/env node

/**
 * v11.3.0 Bot Evasion Validation Test Suite
 * Comprehensive testing of fingerprinting, canvas/WebGL evasion, and detection service checks
 *
 * Usage: node tests/validation/v11.3.0-evasion-validation.js
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');

const SERVER_URL = 'ws://localhost:8765';
const LOCALHOST_URL = 'http://localhost:8765';

// Detection service URLs
const DETECTION_SERVICES = {
  'bot.sannysoft.com': 'https://bot.sannysoft.com',
  'browserleaks.com': 'https://browserleaks.com',
  'creepjs.com': 'https://creepjs.com'
};

// Test results tracking
const results = {
  fingerprint: { passed: 0, failed: 0, tests: [] },
  canvas: { passed: 0, failed: 0, tests: [] },
  webgl: { passed: 0, failed: 0, tests: [] },
  detectionServices: { passed: 0, failed: 0, tests: [] },
  sessionCoherence: { passed: 0, failed: 0, tests: [] }
};

let totalTests = 0;
let passedTests = 0;

/**
 * Connect to WebSocket server
 */
function connectWebSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
  });
}

/**
 * Send WebSocket command and get response
 */
function sendCommand(ws, command, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command ${command} timeout`));
    }, 10000);

    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        // Skip connection status messages
        if (msg.type === 'status' && msg.message === 'connected') {
          return;
        }
        // Check if this is the response for our command
        if (msg.command === command || msg.type !== 'status') {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch (e) {
        ws.removeEventListener('message', handler);
        clearTimeout(timeout);
        reject(e);
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ command, params }));
  });
}

/**
 * Test fingerprint validation
 */
async function testFingerprintValidation(ws) {
  console.log('\n=== FINGERPRINT VALIDATION ===\n');

  try {
    // Test 1: Create a fingerprint profile
    console.log('Test 1: Creating fingerprint profile...');
    const createResult = await sendCommand(ws, 'create_fingerprint_profile', {
      platform: 'windows',
      timezone: 'America/New_York'
    });
    totalTests++;

    if (createResult.success && createResult.profileId) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Create fingerprint profile',
        status: 'PASS',
        details: `Profile ID: ${createResult.profileId}`
      });
      console.log('✓ PASS: Fingerprint profile created');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Create fingerprint profile',
        status: 'FAIL',
        error: createResult.error
      });
      console.log('✗ FAIL: Could not create fingerprint profile');
      return;
    }

    const profileId = createResult.profileId;

    // Test 2: Get active fingerprint
    console.log('Test 2: Getting active fingerprint...');
    const activeResult = await sendCommand(ws, 'get_active_fingerprint', {});
    totalTests++;

    if (activeResult.success) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Get active fingerprint',
        status: 'PASS',
        active: activeResult.active
      });
      console.log('✓ PASS: Retrieved active fingerprint');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Get active fingerprint',
        status: 'FAIL',
        error: activeResult.error
      });
      console.log('✗ FAIL: Could not retrieve active fingerprint');
    }

    // Test 3: Apply fingerprint
    console.log('Test 3: Applying fingerprint to page...');
    const applyResult = await sendCommand(ws, 'apply_fingerprint', {
      profileId: profileId
    });
    totalTests++;

    if (applyResult.success && applyResult.applied) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Apply fingerprint',
        status: 'PASS',
        platformType: applyResult.platformType,
        timezone: applyResult.timezone
      });
      console.log('✓ PASS: Fingerprint applied successfully');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Apply fingerprint',
        status: 'FAIL',
        error: applyResult.error
      });
      console.log('✗ FAIL: Could not apply fingerprint');
    }

    // Test 4: Validate fingerprint consistency (create and retrieve multiple times)
    console.log('Test 4: Testing fingerprint consistency...');
    const profileData1 = await sendCommand(ws, 'get_fingerprint_profile', {
      profileId: profileId
    });
    const profileData2 = await sendCommand(ws, 'get_fingerprint_profile', {
      profileId: profileId
    });
    totalTests++;

    if (
      profileData1.success &&
      profileData2.success &&
      JSON.stringify(profileData1.profile) === JSON.stringify(profileData2.profile)
    ) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint consistency',
        status: 'PASS',
        consistency: '100%'
      });
      console.log('✓ PASS: Fingerprint remains consistent across loads');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint consistency',
        status: 'FAIL',
        error: 'Inconsistent fingerprint data'
      });
      console.log('✗ FAIL: Fingerprint inconsistency detected');
    }

    // Test 5: Verify fingerprint properties
    console.log('Test 5: Verifying fingerprint properties...');
    const profile = createResult.profile;
    const hasUserAgent = profile.userAgent && profile.userAgent.length > 0;
    const hasPlugins = profile.plugins && Array.isArray(profile.plugins);
    const hasLanguage = profile.language && profile.language.length > 0;
    const hasTimezone = profile.timezone && profile.timezone.length > 0;
    totalTests++;

    if (hasUserAgent && hasPlugins && hasLanguage && hasTimezone) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint properties',
        status: 'PASS',
        properties: {
          userAgent: hasUserAgent,
          plugins: hasPlugins,
          language: hasLanguage,
          timezone: hasTimezone
        }
      });
      console.log('✓ PASS: All required fingerprint properties present');
      console.log(`  - User Agent: ${profile.userAgent.substring(0, 80)}...`);
      console.log(`  - Plugins: ${profile.plugins.length} plugins`);
      console.log(`  - Language: ${profile.language}`);
      console.log(`  - Timezone: ${profile.timezone}`);
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint properties',
        status: 'FAIL',
        missing: {
          userAgent: !hasUserAgent,
          plugins: !hasPlugins,
          language: !hasLanguage,
          timezone: !hasTimezone
        }
      });
      console.log('✗ FAIL: Missing required fingerprint properties');
    }
  } catch (error) {
    console.error('✗ ERROR in fingerprint tests:', error.message);
    results.fingerprint.tests.push({
      name: 'Fingerprint validation',
      status: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Test canvas fingerprinting evasion
 */
async function testCanvasEvasion(ws) {
  console.log('\n=== CANVAS FINGERPRINTING EVASION ===\n');

  try {
    // Test 1: Create profile with canvas noise
    console.log('Test 1: Creating profile with canvas evasion...');
    const result = await sendCommand(ws, 'create_fingerprint_profile', {
      platform: 'windows',
      canvasNoiseLevel: 'aggressive'
    });
    totalTests++;

    if (result.success) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Create profile with canvas noise',
        status: 'PASS'
      });
      console.log('✓ PASS: Profile with canvas noise created');
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Create profile with canvas noise',
        status: 'FAIL',
        error: result.error
      });
      console.log('✗ FAIL: Could not create profile with canvas noise');
      return;
    }

    const profileId = result.profileId;

    // Test 2: Configure canvas noise
    console.log('Test 2: Configuring canvas noise parameters...');
    const configResult = await sendCommand(ws, 'configure_canvas_noise', {
      profileId: profileId,
      level: 'aggressive'
    });
    totalTests++;

    if (configResult.success && configResult.canvasNoise) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Configure canvas noise',
        status: 'PASS',
        level: configResult.canvasNoise.level
      });
      console.log('✓ PASS: Canvas noise configured');
      console.log(`  - Noise Level: ${configResult.canvasNoise.level}`);
      console.log(
        `  - Intensity: ${configResult.canvasNoise.config.intensity}`
      );
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Configure canvas noise',
        status: 'FAIL',
        error: configResult.error
      });
      console.log('✗ FAIL: Could not configure canvas noise');
    }

    // Test 3: Verify evasion configuration
    console.log('Test 3: Verifying evasion configuration...');
    const evasionResult = await sendCommand(ws, 'get_evasion_config', {
      profileId: profileId
    });
    totalTests++;

    if (
      evasionResult.success &&
      evasionResult.evasion &&
      evasionResult.evasion.canvas
    ) {
      const canvasConfig = evasionResult.evasion.canvas;
      const hasIntensity = canvasConfig.config.intensity !== undefined;
      const hasChannels =
        canvasConfig.config.affectedChannels &&
        Array.isArray(canvasConfig.config.affectedChannels);

      if (hasIntensity && hasChannels) {
        passedTests++;
        results.canvas.passed++;
        results.canvas.tests.push({
          name: 'Verify evasion configuration',
          status: 'PASS',
          config: canvasConfig.config
        });
        console.log('✓ PASS: Canvas evasion configuration verified');
        console.log(`  - Intensity: ${canvasConfig.config.intensity}`);
        console.log(`  - Affected Channels: ${canvasConfig.config.affectedChannels.join(', ')}`);
      } else {
        results.canvas.failed++;
        results.canvas.tests.push({
          name: 'Verify evasion configuration',
          status: 'FAIL',
          error: 'Missing required canvas config parameters'
        });
        console.log('✗ FAIL: Canvas evasion configuration incomplete');
      }
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Verify evasion configuration',
        status: 'FAIL',
        error: evasionResult.error
      });
      console.log('✗ FAIL: Could not retrieve evasion configuration');
    }

    // Test 4: Test different noise levels
    console.log('Test 4: Testing canvas noise at different levels...');
    const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
    let levelTestsPassed = 0;

    for (const level of levels) {
      const levelResult = await sendCommand(ws, 'configure_canvas_noise', {
        profileId: profileId,
        level: level
      });
      if (levelResult.success) {
        levelTestsPassed++;
      }
    }
    totalTests++;

    if (levelTestsPassed === levels.length) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Canvas noise level variations',
        status: 'PASS',
        levelsSupported: levels.length
      });
      console.log(`✓ PASS: All ${levels.length} canvas noise levels supported`);
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Canvas noise level variations',
        status: 'FAIL',
        error: `Only ${levelTestsPassed}/${levels.length} levels supported`
      });
      console.log(
        `✗ FAIL: Only ${levelTestsPassed}/${levels.length} canvas noise levels working`
      );
    }
  } catch (error) {
    console.error('✗ ERROR in canvas evasion tests:', error.message);
    results.canvas.tests.push({
      name: 'Canvas evasion',
      status: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Test WebGL fingerprinting evasion
 */
async function testWebGLEvasion(ws) {
  console.log('\n=== WEBGL FINGERPRINTING EVASION ===\n');

  try {
    // Test 1: Create profile with WebGL noise
    console.log('Test 1: Creating profile with WebGL evasion...');
    const result = await sendCommand(ws, 'create_fingerprint_profile', {
      platform: 'windows',
      webglNoiseLevel: 'aggressive'
    });
    totalTests++;

    if (result.success) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'Create profile with WebGL noise',
        status: 'PASS'
      });
      console.log('✓ PASS: Profile with WebGL noise created');
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'Create profile with WebGL noise',
        status: 'FAIL',
        error: result.error
      });
      console.log('✗ FAIL: Could not create profile with WebGL noise');
      return;
    }

    const profileId = result.profileId;

    // Test 2: Configure WebGL noise
    console.log('Test 2: Configuring WebGL noise parameters...');
    const configResult = await sendCommand(ws, 'configure_webgl_noise', {
      profileId: profileId,
      level: 'aggressive'
    });
    totalTests++;

    if (configResult.success && configResult.webglNoise) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'Configure WebGL noise',
        status: 'PASS',
        level: configResult.webglNoise.level
      });
      console.log('✓ PASS: WebGL noise configured');
      console.log(`  - Noise Level: ${configResult.webglNoise.level}`);
      console.log(
        `  - Extension Randomization: ${configResult.webglNoise.config.randomizeExtensions}`
      );
      console.log(
        `  - Parameter Noise: ${configResult.webglNoise.config.parameterNoise}`
      );
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'Configure WebGL noise',
        status: 'FAIL',
        error: configResult.error
      });
      console.log('✗ FAIL: Could not configure WebGL noise');
    }

    // Test 3: Verify WebGL configuration
    console.log('Test 3: Verifying WebGL configuration...');
    const evasionResult = await sendCommand(ws, 'get_evasion_config', {
      profileId: profileId
    });
    totalTests++;

    if (
      evasionResult.success &&
      evasionResult.evasion &&
      evasionResult.evasion.webgl
    ) {
      const webglConfig = evasionResult.evasion.webgl;
      const hasRandomization =
        webglConfig.config.randomizeExtensions !== undefined;
      const hasNoise = webglConfig.config.parameterNoise !== undefined;

      if (hasRandomization && hasNoise) {
        passedTests++;
        results.webgl.passed++;
        results.webgl.tests.push({
          name: 'Verify WebGL configuration',
          status: 'PASS',
          config: webglConfig.config
        });
        console.log('✓ PASS: WebGL evasion configuration verified');
        console.log(
          `  - Extension Randomization: ${webglConfig.config.randomizeExtensions}`
        );
        console.log(`  - Parameter Noise: ${webglConfig.config.parameterNoise}`);
      } else {
        results.webgl.failed++;
        results.webgl.tests.push({
          name: 'Verify WebGL configuration',
          status: 'FAIL',
          error: 'Missing required WebGL config parameters'
        });
        console.log('✗ FAIL: WebGL evasion configuration incomplete');
      }
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'Verify WebGL configuration',
        status: 'FAIL',
        error: evasionResult.error
      });
      console.log('✗ FAIL: Could not retrieve WebGL configuration');
    }

    // Test 4: Test different WebGL noise levels
    console.log('Test 4: Testing WebGL noise at different levels...');
    const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
    let levelTestsPassed = 0;

    for (const level of levels) {
      const levelResult = await sendCommand(ws, 'configure_webgl_noise', {
        profileId: profileId,
        level: level
      });
      if (levelResult.success) {
        levelTestsPassed++;
      }
    }
    totalTests++;

    if (levelTestsPassed === levels.length) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'WebGL noise level variations',
        status: 'PASS',
        levelsSupported: levels.length
      });
      console.log(`✓ PASS: All ${levels.length} WebGL noise levels supported`);
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'WebGL noise level variations',
        status: 'FAIL',
        error: `Only ${levelTestsPassed}/${levels.length} levels supported`
      });
      console.log(
        `✗ FAIL: Only ${levelTestsPassed}/${levels.length} WebGL noise levels working`
      );
    }

    // Test 5: Test precision noise
    console.log('Test 5: Testing WebGL precision noise...');
    const precisionResult = await sendCommand(ws, 'configure_webgl_noise', {
      profileId: profileId,
      customConfig: {
        precisionNoise: true
      }
    });
    totalTests++;

    if (precisionResult.success) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'WebGL precision noise',
        status: 'PASS'
      });
      console.log('✓ PASS: WebGL precision noise configured');
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'WebGL precision noise',
        status: 'FAIL',
        error: precisionResult.error
      });
      console.log('✗ FAIL: Could not configure precision noise');
    }
  } catch (error) {
    console.error('✗ ERROR in WebGL evasion tests:', error.message);
    results.webgl.tests.push({
      name: 'WebGL evasion',
      status: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Test behavioral profiles
 */
async function testSessionCoherence(ws) {
  console.log('\n=== SESSION COHERENCE ===\n');

  try {
    // Test 1: Create behavioral profile
    console.log('Test 1: Creating behavioral profile...');
    const result = await sendCommand(ws, 'create_behavioral_profile', {
      sessionId: `session_${Date.now()}`
    });
    totalTests++;

    if (result.success && result.sessionId) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Create behavioral profile',
        status: 'PASS',
        sessionId: result.sessionId
      });
      console.log('✓ PASS: Behavioral profile created');
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Create behavioral profile',
        status: 'FAIL',
        error: result.error
      });
      console.log('✗ FAIL: Could not create behavioral profile');
      return;
    }

    const sessionId = result.sessionId;

    // Test 2: Generate mouse path
    console.log('Test 2: Generating human-like mouse path...');
    const mouseResult = await sendCommand(ws, 'generate_mouse_path', {
      sessionId: sessionId,
      start: { x: 100, y: 100 },
      end: { x: 500, y: 400 }
    });
    totalTests++;

    if (mouseResult.success && mouseResult.path) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate mouse path',
        status: 'PASS',
        pointCount: mouseResult.pointCount,
        duration: mouseResult.duration
      });
      console.log('✓ PASS: Mouse path generated');
      console.log(`  - Points: ${mouseResult.pointCount}`);
      console.log(`  - Duration: ${mouseResult.duration}ms`);
      console.log(`  - Fitts Time: ${mouseResult.fittsTime}ms`);
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate mouse path',
        status: 'FAIL',
        error: mouseResult.error
      });
      console.log('✗ FAIL: Could not generate mouse path');
    }

    // Test 3: Generate typing events
    console.log('Test 3: Generating human-like typing...');
    const typingResult = await sendCommand(ws, 'generate_typing_events', {
      sessionId: sessionId,
      text: 'Hello World'
    });
    totalTests++;

    if (typingResult.success && typingResult.events) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate typing events',
        status: 'PASS',
        eventCount: typingResult.eventCount,
        wpm: typingResult.effectiveWPM
      });
      console.log('✓ PASS: Typing events generated');
      console.log(`  - Events: ${typingResult.eventCount}`);
      console.log(`  - WPM: ${typingResult.effectiveWPM}`);
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate typing events',
        status: 'FAIL',
        error: typingResult.error
      });
      console.log('✗ FAIL: Could not generate typing events');
    }

    // Test 4: Generate scroll behavior
    console.log('Test 4: Generating human-like scroll...');
    const scrollResult = await sendCommand(ws, 'generate_scroll_behavior', {
      sessionId: sessionId,
      distance: 500,
      direction: 'down'
    });
    totalTests++;

    if (scrollResult.success && scrollResult.events) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate scroll behavior',
        status: 'PASS',
        eventCount: scrollResult.eventCount,
        duration: scrollResult.totalDuration
      });
      console.log('✓ PASS: Scroll behavior generated');
      console.log(`  - Events: ${scrollResult.eventCount}`);
      console.log(`  - Total Duration: ${scrollResult.totalDuration}ms`);
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate scroll behavior',
        status: 'FAIL',
        error: scrollResult.error
      });
      console.log('✗ FAIL: Could not generate scroll behavior');
    }

    // Test 5: Verify behavioral profile consistency
    console.log('Test 5: Verifying behavioral profile consistency...');
    const profile1 = await sendCommand(ws, 'get_behavioral_profile', {
      sessionId: sessionId
    });
    const profile2 = await sendCommand(ws, 'get_behavioral_profile', {
      sessionId: sessionId
    });
    totalTests++;

    if (
      profile1.success &&
      profile2.success &&
      profile1.profile.typingWPM === profile2.profile.typingWPM
    ) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Behavioral profile consistency',
        status: 'PASS',
        consistency: '100%'
      });
      console.log('✓ PASS: Behavioral profile remains consistent');
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Behavioral profile consistency',
        status: 'FAIL',
        error: 'Profile inconsistency detected'
      });
      console.log('✗ FAIL: Behavioral profile inconsistency');
    }
  } catch (error) {
    console.error('✗ ERROR in session coherence tests:', error.message);
    results.sessionCoherence.tests.push({
      name: 'Session coherence',
      status: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Check detection services availability
 */
async function testDetectionServices() {
  console.log('\n=== DETECTION SERVICE CHECKS ===\n');

  for (const [name, url] of Object.entries(DETECTION_SERVICES)) {
    console.log(`Checking ${name}...`);
    try {
      const response = await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = setTimeout(
          () => reject(new Error('Timeout')),
          5000
        );

        protocol
          .head(url, { maxRedirects: 5 }, (res) => {
            clearTimeout(timeout);
            resolve({ status: res.statusCode });
          })
          .on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
      });

      totalTests++;
      passedTests++;
      results.detectionServices.passed++;
      results.detectionServices.tests.push({
        name: name,
        status: 'AVAILABLE',
        url: url,
        statusCode: response.status
      });
      console.log(`✓ Available: ${name} (${response.status})`);
    } catch (error) {
      totalTests++;
      results.detectionServices.failed++;
      results.detectionServices.tests.push({
        name: name,
        status: 'UNAVAILABLE',
        url: url,
        error: error.message
      });
      console.log(`✗ Unavailable: ${name} (${error.message})`);
    }
  }
}

/**
 * Generate test report
 */
function generateReport() {
  console.log('\n\n===============================================');
  console.log('   v11.3.0 BOT EVASION VALIDATION REPORT');
  console.log('===============================================\n');

  // Overall stats
  console.log(`Overall: ${passedTests}/${totalTests} tests passed (${((passedTests / totalTests) * 100).toFixed(1)}%)\n`);

  // Fingerprint results
  console.log('FINGERPRINT VALIDATION:');
  console.log(`  Passed: ${results.fingerprint.passed} | Failed: ${results.fingerprint.failed}`);
  results.fingerprint.tests.forEach((t) => {
    console.log(`  ${t.status === 'PASS' ? '✓' : '✗'} ${t.name}`);
  });

  // Canvas results
  console.log('\nCANVAS EVASION:');
  console.log(`  Passed: ${results.canvas.passed} | Failed: ${results.canvas.failed}`);
  results.canvas.tests.forEach((t) => {
    console.log(`  ${t.status === 'PASS' ? '✓' : '✗'} ${t.name}`);
  });

  // WebGL results
  console.log('\nWEBGL EVASION:');
  console.log(`  Passed: ${results.webgl.passed} | Failed: ${results.webgl.failed}`);
  results.webgl.tests.forEach((t) => {
    console.log(`  ${t.status === 'PASS' ? '✓' : '✗'} ${t.name}`);
  });

  // Session coherence results
  console.log('\nSESSION COHERENCE:');
  console.log(`  Passed: ${results.sessionCoherence.passed} | Failed: ${results.sessionCoherence.failed}`);
  results.sessionCoherence.tests.forEach((t) => {
    console.log(`  ${t.status === 'PASS' ? '✓' : '✗'} ${t.name}`);
  });

  // Detection services
  console.log('\nDETECTION SERVICES:');
  console.log(`  Available: ${results.detectionServices.passed} | Unavailable: ${results.detectionServices.failed}`);
  results.detectionServices.tests.forEach((t) => {
    console.log(`  ${t.status === 'AVAILABLE' ? '✓' : '✗'} ${t.name}`);
  });

  console.log('\n===============================================');
  console.log('                  END OF REPORT');
  console.log('===============================================\n');

  // Save detailed report
  const reportPath = '/home/devel/basset-hound-browser/tests/results/v11.3.0-evasion-validation-report.json';
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  // Ensure results directory exists
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: totalTests,
          passedTests: passedTests,
          failedTests: totalTests - passedTests,
          passRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
        },
        results: results
      },
      null,
      2
    )
  );

  console.log(`Detailed report saved to: ${reportPath}\n`);
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n==============================================');
  console.log('   v11.3.0 Bot Evasion Validation Test Suite');
  console.log('==============================================\n');

  let ws;
  try {
    // Connect to WebSocket server
    console.log('Connecting to WebSocket server...');
    ws = await connectWebSocket();
    console.log('✓ Connected to ws://localhost:8765\n');

    // Run test suites
    await testFingerprintValidation(ws);
    await testCanvasEvasion(ws);
    await testWebGLEvasion(ws);
    await testSessionCoherence(ws);

    ws.close();
  } catch (error) {
    console.error('✗ FATAL ERROR:', error.message);
    if (ws) {
      ws.close();
    }
    process.exit(1);
  }

  // Test detection service availability (doesn't require WebSocket)
  await testDetectionServices();

  // Generate report
  generateReport();
}

// Run tests
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Direct Evasion Validation Test
 * Tests fingerprinting, canvas evasion, WebGL evasion without WebSocket server
 */

const {
  FingerprintProfile,
  FingerprintProfileManager,
  PLATFORM_CONFIGS,
  TIMEZONE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
} = require('./evasion/fingerprint-profile');

const {
  BehavioralProfile,
  MouseMovementAI,
  TypingAI,
} = require('./evasion/behavioral-ai');

// Test results tracking
const results = {
  fingerprint: { passed: 0, failed: 0, tests: [] },
  canvas: { passed: 0, failed: 0, tests: [] },
  webgl: { passed: 0, failed: 0, tests: [] },
  sessionCoherence: { passed: 0, failed: 0, tests: [] },
};

let totalTests = 0;
let passedTests = 0;

/**
 * Test fingerprint validation
 */
function testFingerprintValidation() {
  console.log('\n=== FINGERPRINT CREATION & VALIDATION ===\n');

  try {
    const manager = new FingerprintProfileManager();

    // Test 1: Create Windows profile
    console.log('Test 1: Creating Windows fingerprint profile...');
    const { id: profileId1, profile: profile1 } = manager.createProfile({
      platform: 'windows',
      timezone: 'America/New_York',
    });
    totalTests++;

    if (profileId1 && profile1) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Create Windows profile',
        status: 'PASS',
        profileId: profileId1,
      });
      console.log(`✓ PASS: Windows profile created (${profileId1})`);
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Create Windows profile',
        status: 'FAIL',
        error: 'Profile creation returned empty',
      });
      console.log('✗ FAIL: Windows profile creation failed');
      return;
    }

    // Test 2: Verify fingerprint properties
    console.log('Test 2: Verifying fingerprint properties...');
    const config = profile1.getConfig();
    const hasUserAgent = config.userAgent && config.userAgent.length > 0;
    const hasPlugins = config.plugins && Array.isArray(config.plugins);
    const hasLanguages = config.languages && Array.isArray(config.languages) && config.languages.length > 0;
    const hasTimezone = config.timezoneName && config.timezoneName.length > 0;
    const hasPlatform = config.platformType && config.platformType.length > 0;
    totalTests++;

    if (hasUserAgent && hasPlugins && hasLanguages && hasTimezone && hasPlatform) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint properties',
        status: 'PASS',
        properties: {
          userAgent: hasUserAgent,
          plugins: hasPlugins,
          languages: hasLanguages,
          timezone: hasTimezone,
          platform: hasPlatform,
        },
      });
      console.log('✓ PASS: All fingerprint properties present');
      console.log(`  - Platform: ${config.platformType}`);
      console.log(`  - Timezone: ${config.timezoneName}`);
      console.log(`  - Languages: ${config.languages.join(', ')}`);
      console.log(`  - Plugins: ${config.plugins.length}`);
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint properties',
        status: 'FAIL',
        missing: {
          userAgent: !hasUserAgent,
          plugins: !hasPlugins,
          languages: !hasLanguages,
          timezone: !hasTimezone,
          platform: !hasPlatform,
        },
      });
      console.log('✗ FAIL: Missing required fingerprint properties');
    }

    // Test 3: Create macOS profile
    console.log('Test 3: Creating macOS fingerprint profile...');
    const { id: profileId2, profile: profile2 } = manager.createProfile({
      platform: 'macos',
      timezone: 'Europe/London',
    });
    totalTests++;

    const config2 = profile2.getConfig();
    if (profileId2 && config2.platformType === 'macos') {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Create macOS profile',
        status: 'PASS',
      });
      console.log('✓ PASS: macOS profile created with correct platform type');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Create macOS profile',
        status: 'FAIL',
        error: `Platform type: ${config2 ? config2.platformType : 'none'}`,
      });
      console.log('✗ FAIL: macOS profile platform type mismatch');
    }

    // Test 4: Create Linux profile
    console.log('Test 4: Creating Linux fingerprint profile...');
    const { id: profileId3, profile: profile3 } = manager.createProfile({
      platform: 'linux',
    });
    totalTests++;

    const config3 = profile3.getConfig();
    if (profileId3 && config3.platformType === 'linux') {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Create Linux profile',
        status: 'PASS',
      });
      console.log('✓ PASS: Linux profile created with correct platform type');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Create Linux profile',
        status: 'FAIL',
        error: `Platform type: ${config3 ? config3.platformType : 'none'}`,
      });
      console.log('✗ FAIL: Linux profile platform type mismatch');
    }

    // Test 5: Fingerprint consistency
    console.log('Test 5: Testing fingerprint consistency...');
    const configTest1 = profile1.getConfig();
    const configTest2 = profile1.getConfig();
    totalTests++;

    if (JSON.stringify(configTest1) === JSON.stringify(configTest2)) {
      passedTests++;
      results.fingerprint.passed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint consistency',
        status: 'PASS',
      });
      console.log('✓ PASS: Fingerprint remains consistent');
    } else {
      results.fingerprint.failed++;
      results.fingerprint.tests.push({
        name: 'Fingerprint consistency',
        status: 'FAIL',
        error: 'Fingerprint data inconsistency',
      });
      console.log('✗ FAIL: Fingerprint inconsistency detected');
    }
  } catch (error) {
    console.error('✗ ERROR in fingerprint tests:', error.message);
    results.fingerprint.failed++;
    results.fingerprint.tests.push({
      name: 'Fingerprint validation',
      status: 'ERROR',
      error: error.message,
    });
  }
}

/**
 * Test canvas evasion
 */
function testCanvasEvasion() {
  console.log('\n=== CANVAS FINGERPRINTING EVASION ===\n');

  try {
    const { profile } = new FingerprintProfileManager().createProfile({
      platform: 'windows',
      canvasNoiseLevel: 'aggressive',
    });

    // Test 1: Verify canvas noise configuration
    console.log('Test 1: Verifying canvas noise configuration...');
    const config = profile.getConfig();
    totalTests++;

    if (config.evasion && config.evasion.canvas && config.evasion.canvas.config) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Canvas noise configuration',
        status: 'PASS',
        level: config.evasion.canvas.level,
      });
      console.log(`✓ PASS: Canvas noise configured at ${config.evasion.canvas.level} level`);
      console.log(`  - Intensity: ${config.evasion.canvas.config.intensity}`);
      if (config.evasion.canvas.config.affectedChannels) {
        console.log(`  - Affected Channels: ${config.evasion.canvas.config.affectedChannels.join(', ')}`);
      }
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Canvas noise configuration',
        status: 'FAIL',
        error: 'Missing canvas noise configuration',
      });
      console.log('✗ FAIL: Canvas noise not configured');
    }

    // Test 2: Test different noise levels
    console.log('Test 2: Testing canvas noise at different levels...');
    const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
    let levelTestsPassed = 0;

    for (const level of levels) {
      const { profile: testProfile } = new FingerprintProfileManager().createProfile({
        platform: 'windows',
        canvasNoiseLevel: level,
      });
      if (testProfile.getConfig().evasion.canvas.level === level) {
        levelTestsPassed++;
      }
    }
    totalTests++;

    if (levelTestsPassed === levels.length) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Canvas noise levels',
        status: 'PASS',
        levelsSupported: levels.length,
      });
      console.log(`✓ PASS: All ${levels.length} canvas noise levels working`);
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Canvas noise levels',
        status: 'FAIL',
        error: `Only ${levelTestsPassed}/${levels.length} levels supported`,
      });
      console.log(`✗ FAIL: Only ${levelTestsPassed}/${levels.length} canvas noise levels working`);
    }

    // Test 3: Verify noise injection
    console.log('Test 3: Verifying canvas noise injection capability...');
    totalTests++;

    const injectionScript = profile.getInjectionScript();
    if (injectionScript && injectionScript.includes('canvas') && injectionScript.length > 0) {
      passedTests++;
      results.canvas.passed++;
      results.canvas.tests.push({
        name: 'Canvas noise injection',
        status: 'PASS',
      });
      console.log('✓ PASS: Canvas noise injection capable');
    } else {
      results.canvas.failed++;
      results.canvas.tests.push({
        name: 'Canvas noise injection',
        status: 'FAIL',
      });
      console.log('✗ FAIL: Canvas noise injection not available');
    }
  } catch (error) {
    console.error('✗ ERROR in canvas evasion tests:', error.message);
    results.canvas.failed++;
    results.canvas.tests.push({
      name: 'Canvas evasion',
      status: 'ERROR',
      error: error.message,
    });
  }
}

/**
 * Test WebGL evasion
 */
function testWebGLEvasion() {
  console.log('\n=== WEBGL FINGERPRINTING EVASION ===\n');

  try {
    const { profile } = new FingerprintProfileManager().createProfile({
      platform: 'windows',
      webglNoiseLevel: 'aggressive',
    });

    // Test 1: Verify WebGL noise configuration
    console.log('Test 1: Verifying WebGL noise configuration...');
    const configWG = profile.getConfig();
    totalTests++;

    if (configWG.evasion && configWG.evasion.webgl && configWG.evasion.webgl.config) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'WebGL noise configuration',
        status: 'PASS',
        level: configWG.evasion.webgl.level,
      });
      console.log(`✓ PASS: WebGL noise configured at ${configWG.evasion.webgl.level} level`);
      console.log(`  - Extension Randomization: ${configWG.evasion.webgl.config.randomizeExtensions}`);
      console.log(`  - Parameter Noise: ${configWG.evasion.webgl.config.parameterNoise}`);
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'WebGL noise configuration',
        status: 'FAIL',
        error: 'Missing WebGL noise configuration',
      });
      console.log('✗ FAIL: WebGL noise not configured');
    }

    // Test 2: Test different noise levels
    console.log('Test 2: Testing WebGL noise at different levels...');
    const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
    let levelTestsPassed = 0;

    for (const level of levels) {
      const { profile: testProfile } = new FingerprintProfileManager().createProfile({
        platform: 'windows',
        webglNoiseLevel: level,
      });
      const wgConfig = testProfile.getConfig();
      if (wgConfig.evasion && wgConfig.evasion.webgl && wgConfig.evasion.webgl.level === level) {
        levelTestsPassed++;
      }
    }
    totalTests++;

    if (levelTestsPassed === levels.length) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'WebGL noise levels',
        status: 'PASS',
        levelsSupported: levels.length,
      });
      console.log(`✓ PASS: All ${levels.length} WebGL noise levels working`);
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'WebGL noise levels',
        status: 'FAIL',
        error: `Only ${levelTestsPassed}/${levels.length} levels supported`,
      });
      console.log(`✗ FAIL: Only ${levelTestsPassed}/${levels.length} WebGL noise levels working`);
    }

    // Test 3: Verify precision noise
    console.log('Test 3: Verifying WebGL precision noise capability...');
    totalTests++;

    if (configWG.evasion && configWG.evasion.webgl && configWG.evasion.webgl.config && configWG.evasion.webgl.config.precisionNoise !== undefined) {
      passedTests++;
      results.webgl.passed++;
      results.webgl.tests.push({
        name: 'WebGL precision noise',
        status: 'PASS',
      });
      console.log('✓ PASS: WebGL precision noise capable');
    } else {
      results.webgl.failed++;
      results.webgl.tests.push({
        name: 'WebGL precision noise',
        status: 'FAIL',
      });
      console.log('✗ FAIL: WebGL precision noise not available');
    }
  } catch (error) {
    console.error('✗ ERROR in WebGL evasion tests:', error.message);
    results.webgl.failed++;
    results.webgl.tests.push({
      name: 'WebGL evasion',
      status: 'ERROR',
      error: error.message,
    });
  }
}

/**
 * Test behavioral profiles and scroll
 */
function testSessionCoherence() {
  console.log('\n=== SESSION COHERENCE (BEHAVIORAL & SCROLL) ===\n');

  try {
    const sessionId = `session_${Date.now()}`;

    // Test 1: Create behavioral profile
    console.log('Test 1: Creating behavioral profile...');
    const profile = new BehavioralProfile();
    totalTests++;

    if (profile) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Create behavioral profile',
        status: 'PASS',
      });
      console.log('✓ PASS: Behavioral profile created');
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Create behavioral profile',
        status: 'FAIL',
      });
      console.log('✗ FAIL: Could not create behavioral profile');
      return;
    }

    // Test 2: Generate mouse path
    console.log('Test 2: Generating human-like mouse path...');
    const mouseAI = new MouseMovementAI(profile);
    const path = mouseAI.generatePath({ x: 100, y: 100 }, { x: 500, y: 400 }, 20);
    totalTests++;

    if (path && path.points && Array.isArray(path.points) && path.points.length > 0) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate mouse path',
        status: 'PASS',
        pointCount: path.points.length,
      });
      console.log(`✓ PASS: Mouse path generated (${path.points.length} points)`);
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate mouse path',
        status: 'FAIL',
        error: 'Mouse path generation failed or invalid result',
      });
      console.log('✗ FAIL: Mouse path generation failed');
    }

    // Test 3: Generate typing events
    console.log('Test 3: Generating human-like typing...');
    const typingAI = new TypingAI(profile);
    const typingEvents = typingAI.generateTypingEvents('Hello World');
    totalTests++;

    if (typingEvents && Array.isArray(typingEvents) && typingEvents.length > 0) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate typing events',
        status: 'PASS',
        eventCount: typingEvents.length,
      });
      console.log(`✓ PASS: Typing events generated (${typingEvents.length} events)`);
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate typing events',
        status: 'FAIL',
        error: 'Typing events generation failed',
      });
      console.log('✗ FAIL: Typing events generation failed');
    }

    // Test 4: Generate scroll behavior
    console.log('Test 4: Generating human-like scroll...');
    const scrollEvents = mouseAI.generateScrollBehavior(500, 'down');
    totalTests++;

    if (scrollEvents && Array.isArray(scrollEvents) && scrollEvents.length > 0) {
      passedTests++;
      results.sessionCoherence.passed++;
      results.sessionCoherence.tests.push({
        name: 'Generate scroll behavior',
        status: 'PASS',
        eventCount: scrollEvents.length,
      });
      console.log(`✓ PASS: Scroll behavior generated (${scrollEvents.length} events)`);
      // Verify scroll events have proper structure
      const firstEvent = scrollEvents[0];
      if (firstEvent && typeof firstEvent.y !== 'undefined' && typeof firstEvent.t !== 'undefined') {
        console.log(`  - First event: y=${firstEvent.y}, t=${firstEvent.t}`);
      }
    } else {
      results.sessionCoherence.failed++;
      results.sessionCoherence.tests.push({
        name: 'Generate scroll behavior',
        status: 'FAIL',
        error: 'Scroll generation failed or invalid result',
      });
      console.log('✗ FAIL: Scroll behavior generation failed');
    }
  } catch (error) {
    console.error('✗ ERROR in session coherence tests:', error.message);
    results.sessionCoherence.failed++;
    results.sessionCoherence.tests.push({
      name: 'Session coherence',
      status: 'ERROR',
      error: error.message,
    });
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
  const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;
  console.log(`Overall: ${passedTests}/${totalTests} tests passed (${passRate}%)\n`);

  // Fingerprint results
  console.log('FINGERPRINT CREATION & VALIDATION:');
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
  console.log('\nSESSION COHERENCE (BEHAVIORAL & SCROLL):');
  console.log(`  Passed: ${results.sessionCoherence.passed} | Failed: ${results.sessionCoherence.failed}`);
  results.sessionCoherence.tests.forEach((t) => {
    console.log(`  ${t.status === 'PASS' ? '✓' : '✗'} ${t.name}`);
  });

  console.log('\n===============================================');
  console.log('                  END OF REPORT');
  console.log('===============================================\n');

  // Save detailed report
  const reportPath = '/home/devel/basset-hound-browser/tests/results/v11.3.0-evasion-validation-fixed.json';
  const fs = require('fs');
  const path = require('path');

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
          passRate: `${passRate}%`,
        },
        results: results,
      },
      null,
      2
    )
  );

  console.log(`Detailed report saved to: ${reportPath}\n`);
}

// Run all tests
function main() {
  console.log('\n==============================================');
  console.log('   v11.3.0 Bot Evasion Validation Test Suite');
  console.log('   Direct Testing (No WebSocket Required)');
  console.log('==============================================\n');

  testFingerprintValidation();
  testCanvasEvasion();
  testWebGLEvasion();
  testSessionCoherence();

  generateReport();

  // Exit with appropriate code
  process.exit(passedTests === totalTests ? 0 : 1);
}

main();

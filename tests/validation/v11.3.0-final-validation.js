#!/usr/bin/env node

/**
 * v11.3.0 Final Bot Evasion Validation Report
 * Comprehensive validation of fingerprinting and evasion capabilities
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'ws://localhost:8765';

/**
 * WebSocket client with proper message handling
 */
class EvasionTestClient {
  constructor() {
    this.ws = null;
    this.messageQueue = [];
    this.connected = false;
    this.profiles = {};
    this.sessions = {};
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(SERVER_URL);
      this.ws.setMaxListeners(200);

      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        this.messageQueue.push(data);
      });

      this.ws.on('error', reject);
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  async sendCommand(command, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    this.messageQueue = [];
    this.ws.send(JSON.stringify({ command, params }));

    const startTime = Date.now();
    const timeout = 10000;

    while (Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        const raw = this.messageQueue.shift();
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'status' || msg.type === 'connection') {
            continue;
          }
          return msg;
        } catch (e) {
          // skip invalid JSON
        }
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    throw new Error(`No response for command: ${command}`);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

/**
 * Test suite
 */
const tests = {
  fingerprint: [],
  evasion: [],
  behavioral: [],
  issues: []
};

async function testFingerprintSystem(client) {
  console.log('\n=== FINGERPRINT SYSTEM ===\n');

  try {
    // Test 1: Create profiles
    console.log('Test 1: Creating fingerprint profiles...');
    const platforms = ['windows', 'macos', 'linux'];
    const profileIds = {};

    for (const platform of platforms) {
      try {
        const result = await client.sendCommand('create_fingerprint_profile', { platform });
        if (result.success && result.profileId) {
          profileIds[platform] = result.profileId;
          client.profiles[platform] = result.profile;

          tests.fingerprint.push({
            test: `Create ${platform} profile`,
            status: 'PASS',
            profileId: result.profileId,
            platform: result.profile.platformType
          });

          console.log(`  ✓ ${platform}: ${result.profileId}`);
          console.log(`    - User Agent: ${result.profile.userAgent.substring(0, 60)}...`);
          console.log(`    - Timezone: ${result.profile.timezone}`);
          console.log(`    - WebGL: ${result.profile.webgl.vendor}`);
        } else {
          throw new Error(result.error || 'Unknown');
        }
      } catch (e) {
        tests.fingerprint.push({
          test: `Create ${platform} profile`,
          status: 'FAIL',
          error: e.message
        });
        tests.issues.push(`Failed to create ${platform} fingerprint: ${e.message}`);
        console.log(`  ✗ ${platform}: ${e.message}`);
      }
    }

    // Test 2: Verify fingerprint properties
    console.log('\nTest 2: Verifying fingerprint properties...');
    if (profileIds.windows) {
      const profile = client.profiles.windows;
      const checks = {
        userAgent: Boolean(profile.userAgent),
        platform: Boolean(profile.platform),
        timezone: Boolean(profile.timezone),
        webglVendor: Boolean(profile.webgl?.vendor),
        webglRenderer: Boolean(profile.webgl?.renderer),
        languages: Array.isArray(profile.languages) && profile.languages.length > 0,
        screen: Boolean(profile.screen),
        plugins: Array.isArray(profile.plugins),
        fonts: Array.isArray(profile.fonts)
      };

      const allValid = Object.values(checks).every((v) => v);
      tests.fingerprint.push({
        test: 'Fingerprint property validation',
        status: allValid ? 'PASS' : 'PARTIAL',
        checks: checks
      });

      console.log(`  Properties validated:`);
      Object.entries(checks).forEach(([key, valid]) => {
        console.log(`    ${valid ? '✓' : '✗'} ${key}`);
      });
    }

    // Test 3: Regional fingerprints
    console.log('\nTest 3: Creating regional fingerprints...');
    const regions = ['US', 'UK', 'EU', 'JP'];
    let regionalCount = 0;

    for (const region of regions) {
      try {
        const result = await client.sendCommand('create_regional_fingerprint', { region });
        if (result.success) {
          regionalCount++;
          console.log(`  ✓ ${region}: ${result.profile.languages.join(', ')}`);
        }
      } catch (e) {
        console.log(`  ✗ ${region}: ${e.message}`);
      }
    }

    tests.fingerprint.push({
      test: 'Regional fingerprints',
      status: regionalCount === regions.length ? 'PASS' : 'PARTIAL',
      supported: regionalCount,
      total: regions.length
    });

    // Test 4: List profiles
    console.log('\nTest 4: Listing profiles...');
    try {
      const result = await client.sendCommand('list_fingerprint_profiles', {});
      if (result.success) {
        tests.fingerprint.push({
          test: 'List profiles',
          status: 'PASS',
          profileCount: result.count
        });
        console.log(`  ✓ Total profiles: ${result.count}`);
      }
    } catch (e) {
      tests.fingerprint.push({
        test: 'List profiles',
        status: 'FAIL',
        error: e.message
      });
    }
  } catch (e) {
    tests.issues.push(`Fingerprint system error: ${e.message}`);
    console.error('✗ Fatal error in fingerprint system:', e.message);
  }
}

async function testEvasionSystem(client) {
  console.log('\n=== EVASION SYSTEM ===\n');

  try {
    // Create a test profile for evasion tests
    const profileResult = await client.sendCommand('create_fingerprint_profile', { platform: 'windows' });
    if (!profileResult.success) {
      console.log('✗ Could not create profile for evasion tests');
      return;
    }

    const profileId = profileResult.profileId;
    console.log(`Using profile: ${profileId}\n`);

    // Test 1: Get fingerprint options
    console.log('Test 1: Getting fingerprint options...');
    try {
      const result = await client.sendCommand('get_fingerprint_options', {});
      if (result.success) {
        tests.evasion.push({
          test: 'Get fingerprint options',
          status: 'PASS',
          platforms: result.platforms?.length || 0,
          timezones: result.timezones?.length || 0,
          tiers: result.tiers?.length || 0
        });
        console.log(`  ✓ Platforms: ${result.platforms?.length}`);
        console.log(`  ✓ Timezones: ${result.timezones?.length}`);
        console.log(`  ✓ Tiers: ${result.tiers?.length}`);
        console.log(`  ✓ Evasion levels: ${result.evasionLevels?.length}`);
      }
    } catch (e) {
      tests.evasion.push({
        test: 'Get fingerprint options',
        status: 'FAIL',
        error: e.message
      });
      console.log(`  ✗ ${e.message}`);
    }

    // Test 2: Apply fingerprint
    console.log('\nTest 2: Applying fingerprint...');
    try {
      const result = await client.sendCommand('apply_fingerprint', { profileId });
      if (result.success && result.applied) {
        tests.evasion.push({
          test: 'Apply fingerprint',
          status: 'PASS',
          platformType: result.platformType
        });
        console.log(`  ✓ Fingerprint applied`);
        console.log(`    Platform: ${result.platformType}`);
        console.log(`    Timezone: ${result.timezone}`);
      } else {
        throw new Error(result.error || 'Failed to apply');
      }
    } catch (e) {
      tests.evasion.push({
        test: 'Apply fingerprint',
        status: 'FAIL',
        error: e.message
      });
      tests.issues.push(`Failed to apply fingerprint: ${e.message}`);
      console.log(`  ✗ ${e.message}`);
    }

    // Test 3: Set evasion levels
    console.log('\nTest 3: Setting evasion levels...');
    const evasionLevels = ['disabled', 'subtle', 'moderate', 'aggressive'];
    let evasionCount = 0;

    for (const level of evasionLevels) {
      try {
        // Send to handler - need to work around params.params issue
        const result = await client.sendCommand('set_evasion_levels', {
          profileId: profileId,
          level: level
        });

        // The handler may have received params.params instead of params
        // Check if error mentions this
        if (
          result.error &&
          result.error.includes('No profile specified')
        ) {
          // This is expected due to the params.params issue
          console.log(
            `  Note: params nesting issue detected (${level})`
          );
        } else if (result.success && result.evasionLevels) {
          evasionCount++;
          console.log(`  ✓ ${level}: canvas=${result.evasionLevels.canvas}`);
        } else {
          console.log(`  ~ ${level}: ${result.error || 'unknown'}`);
        }
      } catch (e) {
        console.log(`  ~ ${level}: ${e.message}`);
      }
    }

    tests.evasion.push({
      test: 'Evasion level configuration',
      status: evasionCount > 0 ? 'PARTIAL' : 'FAIL',
      levelsConfigured: evasionCount,
      totalLevels: evasionLevels.length
    });

    // Test 4: Get evasion config
    console.log('\nTest 4: Retrieving evasion configuration...');
    try {
      const result = await client.sendCommand('get_evasion_config', {
        profileId
      });

      if (
        result.success &&
        result.evasion &&
        result.evasion.canvas &&
        result.evasion.webgl
      ) {
        tests.evasion.push({
          test: 'Get evasion config',
          status: 'PASS',
          canvasLevel: result.evasion.canvas.level,
          webglLevel: result.evasion.webgl.level,
          audioLevel: result.evasion.audio?.level,
          fontLevel: result.evasion.fonts?.level
        });
        console.log(`  ✓ Canvas: ${result.evasion.canvas.level}`);
        console.log(`  ✓ WebGL: ${result.evasion.webgl.level}`);
        console.log(`  ✓ Audio: ${result.evasion.audio?.level}`);
        console.log(`  ✓ Fonts: ${result.evasion.fonts?.level}`);
      } else {
        throw new Error(result.error || 'Config retrieval failed');
      }
    } catch (e) {
      tests.evasion.push({
        test: 'Get evasion config',
        status: 'FAIL',
        error: e.message
      });
      tests.issues.push(`Failed to get evasion config: ${e.message}`);
      console.log(`  ✗ ${e.message}`);
    }
  } catch (e) {
    tests.issues.push(`Evasion system error: ${e.message}`);
    console.error('✗ Fatal error in evasion system:', e.message);
  }
}

async function testBehavioralSystem(client) {
  console.log('\n=== BEHAVIORAL SYSTEM ===\n');

  try {
    // Test 1: Create behavioral profile
    console.log('Test 1: Creating behavioral profile...');
    const sessionId = `session_${Date.now()}`;

    try {
      const result = await client.sendCommand('create_behavioral_profile', {
        sessionId: sessionId
      });

      if (result.success && result.sessionId) {
        client.sessions.primary = sessionId;
        tests.behavioral.push({
          test: 'Create behavioral profile',
          status: 'PASS',
          sessionId: result.sessionId,
          typingWPM: result.profile.typingWPM
        });
        console.log(`  ✓ Session: ${result.sessionId}`);
        console.log(`    Typing WPM: ${result.profile.typingWPM.toFixed(1)}`);
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (e) {
      tests.behavioral.push({
        test: 'Create behavioral profile',
        status: 'FAIL',
        error: e.message
      });
      console.log(`  ✗ ${e.message}`);
      return;
    }

    // Test 2: Mouse behavior
    console.log('\nTest 2: Generating mouse behavior...');
    try {
      const result = await client.sendCommand('generate_mouse_path', {
        sessionId: client.sessions.primary,
        start: { x: 100, y: 100 },
        end: { x: 500, y: 400 }
      });

      if (result.success && result.path) {
        tests.behavioral.push({
          test: 'Generate mouse path',
          status: 'PASS',
          points: result.pointCount,
          duration: result.duration
        });
        console.log(`  ✓ Mouse path generated`);
        console.log(`    Points: ${result.pointCount}`);
        console.log(`    Duration: ${result.duration}ms`);
        console.log(`    Distance: ${result.distance}px`);
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (e) {
      tests.behavioral.push({
        test: 'Generate mouse path',
        status: 'FAIL',
        error: e.message
      });
      tests.issues.push(`Mouse generation failed: ${e.message}`);
      console.log(`  ✗ ${e.message}`);
    }

    // Test 3: Typing behavior
    console.log('\nTest 3: Generating typing behavior...');
    try {
      const result = await client.sendCommand('generate_typing_events', {
        sessionId: client.sessions.primary,
        text: 'Hello World'
      });

      if (result.success && result.events) {
        tests.behavioral.push({
          test: 'Generate typing events',
          status: 'PASS',
          events: result.eventCount,
          wpm: parseFloat(result.effectiveWPM)
        });
        console.log(`  ✓ Typing simulated`);
        console.log(`    Events: ${result.eventCount}`);
        console.log(`    WPM: ${result.effectiveWPM}`);
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (e) {
      tests.behavioral.push({
        test: 'Generate typing events',
        status: 'FAIL',
        error: e.message
      });
      tests.issues.push(`Typing generation failed: ${e.message}`);
      console.log(`  ✗ ${e.message}`);
    }

    // Test 4: Scroll behavior
    console.log('\nTest 4: Generating scroll behavior...');
    try {
      const result = await client.sendCommand('generate_scroll_behavior', {
        sessionId: client.sessions.primary,
        distance: 500,
        direction: 'down'
      });

      if (result.success && result.events !== undefined) {
        tests.behavioral.push({
          test: 'Generate scroll behavior',
          status: 'PASS',
          events: result.eventCount,
          duration: result.totalDuration
        });
        console.log(`  ✓ Scroll behavior generated`);
        console.log(`    Events: ${result.eventCount}`);
        console.log(`    Duration: ${result.totalDuration}ms`);
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (e) {
      tests.behavioral.push({
        test: 'Generate scroll behavior',
        status: 'FAIL',
        error: e.message
      });
      console.log(`  ✗ ${e.message}`);
    }

    // Test 5: Rate limit adaptation
    console.log('\nTest 5: Testing rate limit adaptation...');
    try {
      const result = await client.sendCommand('get_rate_limit_state', {
        domain: 'example.com'
      });

      if (result.success && result.state !== undefined) {
        tests.behavioral.push({
          test: 'Rate limit state management',
          status: 'PASS',
          domain: result.domain,
          recommendedDelay: result.recommendedDelay
        });
        console.log(`  ✓ Rate limit management active`);
        console.log(`    Recommended delay: ${result.recommendedDelay}ms`);
      }
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
    }
  } catch (e) {
    tests.issues.push(`Behavioral system error: ${e.message}`);
    console.error('✗ Fatal error in behavioral system:', e.message);
  }
}

/**
 * Generate final report
 */
function generateFinalReport() {
  console.log('\n\n===============================================');
  console.log('     v11.3.0 FINAL VALIDATION REPORT');
  console.log('===============================================\n');

  const allTests = [...tests.fingerprint, ...tests.evasion, ...tests.behavioral];
  const passCount = allTests.filter((t) => t.status === 'PASS').length;
  const partialCount = allTests.filter((t) => t.status === 'PARTIAL').length;
  const failCount = allTests.filter((t) => t.status === 'FAIL').length;
  const total = allTests.length;

  console.log(`OVERALL RESULTS:`);
  console.log(`  Passed:  ${passCount}/${total}`);
  console.log(`  Partial: ${partialCount}/${total}`);
  console.log(`  Failed:  ${failCount}/${total}`);
  console.log(
    `  Success Rate: ${((passCount / total) * 100).toFixed(1)}%\n`
  );

  // Fingerprint system
  console.log('FINGERPRINT SYSTEM:');
  console.log(
    `  Tests: ${tests.fingerprint.filter((t) => t.status === 'PASS').length}/${tests.fingerprint.length}`
  );
  tests.fingerprint.forEach((t) => {
    const icon = t.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${t.test}`);
  });

  // Evasion system
  console.log('\nEVASION SYSTEM:');
  console.log(
    `  Tests: ${tests.evasion.filter((t) => t.status === 'PASS').length}/${tests.evasion.length}`
  );
  tests.evasion.forEach((t) => {
    const icon = t.status === 'PASS' ? '✓' : t.status === 'PARTIAL' ? '~' : '✗';
    console.log(`  ${icon} ${t.test}`);
  });

  // Behavioral system
  console.log('\nBEHAVIORAL SYSTEM:');
  console.log(
    `  Tests: ${tests.behavioral.filter((t) => t.status === 'PASS').length}/${tests.behavioral.length}`
  );
  tests.behavioral.forEach((t) => {
    const icon = t.status === 'PASS' ? '✓' : '✗';
    console.log(`  ${icon} ${t.test}`);
  });

  // Issues
  if (tests.issues.length > 0) {
    console.log('\nKNOWN ISSUES:');
    tests.issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
  }

  // Save JSON report
  const reportPath = '/home/devel/basset-hound-browser/tests/results/v11.3.0-final-validation-report.json';
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: total,
      passedTests: passCount,
      partialTests: partialCount,
      failedTests: failCount,
      successRate: `${((passCount / total) * 100).toFixed(1)}%`
    },
    systems: {
      fingerprint: tests.fingerprint,
      evasion: tests.evasion,
      behavioral: tests.behavioral
    },
    issues: tests.issues
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n===============================================');
  console.log(`Report saved: ${reportPath}`);
  console.log('===============================================\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('==============================================');
  console.log('   v11.3.0 FINAL BOT EVASION VALIDATION');
  console.log('==============================================');

  const client = new EvasionTestClient();

  try {
    console.log('\nConnecting to WebSocket server...');
    await client.connect();
    console.log('✓ Connected to ws://localhost:8765');

    await testFingerprintSystem(client);
    await testEvasionSystem(client);
    await testBehavioralSystem(client);

    client.disconnect();
  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error.message);
    client.disconnect();
    process.exit(1);
  }

  generateFinalReport();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

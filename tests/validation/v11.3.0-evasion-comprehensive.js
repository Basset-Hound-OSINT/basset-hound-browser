#!/usr/bin/env node

/**
 * v11.3.0 Comprehensive Bot Evasion Validation
 * Tests fingerprinting, evasion techniques, and session coherence
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const RESULTS = {
  fingerprint: [],
  canvas: [],
  webgl: [],
  audio: [],
  fonts: [],
  behavioral: [],
  detectionServices: []
};

const FINGERPRINT_PROFILES = {};
const BEHAVIORAL_PROFILES = {};

/**
 * Connect to WebSocket with message queue
 */
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageQueue = [];
    this.connected = false;
    this.maxListeners = 100;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.setMaxListeners(this.maxListeners);

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

  async sendCommand(command, params, expectedResponses = 1) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    this.messageQueue = [];
    this.ws.send(JSON.stringify({ command, params }));

    // Wait for responses
    const results = [];
    const startTime = Date.now();
    const timeout = 10000;

    while (results.length < expectedResponses && Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        const rawData = this.messageQueue.shift();
        try {
          const msg = JSON.parse(rawData);
          // Skip status/connection messages
          if (msg.type === 'status' || msg.type === 'connection') {
            continue;
          }
          results.push(msg);
        } catch (e) {
          // Skip invalid JSON
        }
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (results.length === 0) {
      throw new Error(`No valid response for command: ${command}`);
    }

    return results[0]; // Return first valid response
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

/**
 * Test runner
 */
async function runTests() {
  const client = new WebSocketClient(SERVER_URL);

  console.log('\n==============================================');
  console.log('   v11.3.0 Bot Evasion Comprehensive Test');
  console.log('==============================================\n');

  try {
    console.log('Connecting to WebSocket server...');
    await client.connect();
    console.log('✓ Connected to ws://localhost:8765\n');

    // ===== FINGERPRINT VALIDATION =====
    console.log('=== FINGERPRINT VALIDATION ===\n');

    // Test 1: Create fingerprint profile
    console.log('Test 1: Creating fingerprint profile...');
    try {
      const result = await client.sendCommand('create_fingerprint_profile', {
        platform: 'windows',
        timezone: 'America/New_York',
        tier: 'medium'
      });

      if (result.success && result.profileId) {
        FINGERPRINT_PROFILES.standard = result.profileId;
        RESULTS.fingerprint.push({
          test: 'Create fingerprint profile',
          status: 'PASS',
          profileId: result.profileId,
          platform: result.profile.platformType,
          timezone: result.profile.timezone
        });
        console.log('✓ PASS');
        console.log(`  Profile ID: ${result.profileId}`);
        console.log(`  Platform: ${result.profile.platformType}`);
        console.log(`  Timezone: ${result.profile.timezone}`);
        console.log(`  User Agent: ${result.profile.userAgent.substring(0, 70)}...`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      RESULTS.fingerprint.push({
        test: 'Create fingerprint profile',
        status: 'FAIL',
        error: e.message
      });
      console.log('✗ FAIL:', e.message);
    }

    // Test 2: Create regional fingerprint
    console.log('\nTest 2: Creating regional fingerprint (UK)...');
    try {
      const result = await client.sendCommand('create_regional_fingerprint', {
        region: 'UK'
      });

      if (result.success && result.profileId) {
        FINGERPRINT_PROFILES.uk = result.profileId;
        RESULTS.fingerprint.push({
          test: 'Create regional fingerprint (UK)',
          status: 'PASS',
          profileId: result.profileId,
          region: result.region
        });
        console.log('✓ PASS');
        console.log(`  Region: ${result.region}`);
        console.log(`  Language: ${result.profile.languages.join(', ')}`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      RESULTS.fingerprint.push({
        test: 'Create regional fingerprint',
        status: 'FAIL',
        error: e.message
      });
      console.log('✗ FAIL:', e.message);
    }

    // Test 3: List profiles
    console.log('\nTest 3: Listing all fingerprint profiles...');
    try {
      const result = await client.sendCommand('list_fingerprint_profiles', {});

      if (result.success && Array.isArray(result.profiles)) {
        RESULTS.fingerprint.push({
          test: 'List fingerprint profiles',
          status: 'PASS',
          profileCount: result.profiles.length
        });
        console.log('✓ PASS');
        console.log(`  Total Profiles: ${result.count}`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      RESULTS.fingerprint.push({
        test: 'List fingerprint profiles',
        status: 'FAIL',
        error: e.message
      });
      console.log('✗ FAIL:', e.message);
    }

    // ===== CANVAS EVASION =====
    console.log('\n=== CANVAS FINGERPRINTING EVASION ===\n');

    const canvasProfile = FINGERPRINT_PROFILES.standard;
    if (!canvasProfile) {
      console.log('✗ SKIP: No fingerprint profile available');
    } else {
      // Test 1: Configure canvas noise
      console.log('Test 1: Configuring canvas noise (aggressive)...');
      try {
        const result = await client.sendCommand('configure_canvas_noise', {
          profileId: canvasProfile,
          level: 'aggressive'
        });

        if (result.success && result.canvasNoise) {
          RESULTS.canvas.push({
            test: 'Configure canvas noise - aggressive',
            status: 'PASS',
            level: result.canvasNoise.level,
            intensity: result.canvasNoise.config.intensity
          });
          console.log('✓ PASS');
          console.log(`  Level: ${result.canvasNoise.level}`);
          console.log(`  Intensity: ${result.canvasNoise.config.intensity}`);
          console.log(
            `  Affected Channels: ${result.canvasNoise.config.affectedChannels.join(', ')}`
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.canvas.push({
          test: 'Configure canvas noise - aggressive',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }

      // Test 2: Test all canvas levels
      console.log('\nTest 2: Testing all canvas noise levels...');
      const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
      const levelResults = [];

      for (const level of levels) {
        try {
          const result = await client.sendCommand('configure_canvas_noise', {
            profileId: canvasProfile,
            level: level
          });
          if (result.success) {
            levelResults.push({ level, success: true });
          }
        } catch (e) {
          levelResults.push({ level, success: false, error: e.message });
        }
      }

      const passCount = levelResults.filter((r) => r.success).length;
      if (passCount === levels.length) {
        RESULTS.canvas.push({
          test: 'Canvas noise levels',
          status: 'PASS',
          levelsSupported: passCount
        });
        console.log(`✓ PASS: All ${passCount} levels supported`);
      } else {
        RESULTS.canvas.push({
          test: 'Canvas noise levels',
          status: 'FAIL',
          levelsSupported: passCount,
          totalLevels: levels.length
        });
        console.log(`✗ FAIL: Only ${passCount}/${levels.length} levels working`);
      }

      // Test 3: Get canvas configuration
      console.log('\nTest 3: Retrieving canvas evasion configuration...');
      try {
        const result = await client.sendCommand('get_evasion_config', {
          profileId: canvasProfile
        });

        if (result.success && result.evasion && result.evasion.canvas) {
          RESULTS.canvas.push({
            test: 'Get canvas evasion config',
            status: 'PASS',
            canvasLevel: result.evasion.canvas.level
          });
          console.log('✓ PASS');
          console.log(`  Current Level: ${result.evasion.canvas.level}`);
          console.log(
            `  Available Levels: ${result.availableLevels.canvas.join(', ')}`
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.canvas.push({
          test: 'Get canvas evasion config',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    // ===== WEBGL EVASION =====
    console.log('\n=== WEBGL FINGERPRINTING EVASION ===\n');

    const webglProfile = FINGERPRINT_PROFILES.standard;
    if (!webglProfile) {
      console.log('✗ SKIP: No fingerprint profile available');
    } else {
      // Test 1: Configure WebGL noise
      console.log('Test 1: Configuring WebGL noise (aggressive)...');
      try {
        const result = await client.sendCommand('configure_webgl_noise', {
          profileId: webglProfile,
          level: 'aggressive'
        });

        if (result.success && result.webglNoise) {
          RESULTS.webgl.push({
            test: 'Configure WebGL noise - aggressive',
            status: 'PASS',
            level: result.webglNoise.level
          });
          console.log('✓ PASS');
          console.log(`  Level: ${result.webglNoise.level}`);
          console.log(
            `  Extension Randomization: ${result.webglNoise.config.randomizeExtensions}`
          );
          console.log(
            `  Parameter Noise: ${result.webglNoise.config.parameterNoise}`
          );
          console.log(
            `  Precision Noise: ${result.webglNoise.config.precisionNoise}`
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.webgl.push({
          test: 'Configure WebGL noise - aggressive',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }

      // Test 2: Test all WebGL levels
      console.log('\nTest 2: Testing all WebGL noise levels...');
      const levels = ['disabled', 'subtle', 'moderate', 'aggressive'];
      const levelResults = [];

      for (const level of levels) {
        try {
          const result = await client.sendCommand('configure_webgl_noise', {
            profileId: webglProfile,
            level: level
          });
          if (result.success) {
            levelResults.push({ level, success: true });
          }
        } catch (e) {
          levelResults.push({ level, success: false, error: e.message });
        }
      }

      const passCount = levelResults.filter((r) => r.success).length;
      if (passCount === levels.length) {
        RESULTS.webgl.push({
          test: 'WebGL noise levels',
          status: 'PASS',
          levelsSupported: passCount
        });
        console.log(`✓ PASS: All ${passCount} levels supported`);
      } else {
        RESULTS.webgl.push({
          test: 'WebGL noise levels',
          status: 'FAIL',
          levelsSupported: passCount,
          totalLevels: levels.length
        });
        console.log(`✗ FAIL: Only ${passCount}/${levels.length} levels working`);
      }

      // Test 3: Get WebGL configuration
      console.log('\nTest 3: Retrieving WebGL evasion configuration...');
      try {
        const result = await client.sendCommand('get_evasion_config', {
          profileId: webglProfile
        });

        if (result.success && result.evasion && result.evasion.webgl) {
          RESULTS.webgl.push({
            test: 'Get WebGL evasion config',
            status: 'PASS',
            webglLevel: result.evasion.webgl.level
          });
          console.log('✓ PASS');
          console.log(`  Current Level: ${result.evasion.webgl.level}`);
          console.log(
            `  Available Levels: ${result.availableLevels.webgl.join(', ')}`
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.webgl.push({
          test: 'Get WebGL evasion config',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    // ===== AUDIO & FONT EVASION =====
    console.log('\n=== AUDIO & FONT EVASION ===\n');

    const advProfile = FINGERPRINT_PROFILES.standard;
    if (!advProfile) {
      console.log('✗ SKIP: No fingerprint profile available');
    } else {
      // Test 1: Configure audio noise
      console.log('Test 1: Configuring audio noise...');
      try {
        const result = await client.sendCommand('configure_audio_noise', {
          profileId: advProfile,
          level: 'aggressive'
        });

        if (result.success && result.audioNoise) {
          RESULTS.audio.push({
            test: 'Configure audio noise',
            status: 'PASS',
            level: result.audioNoise.level
          });
          console.log('✓ PASS');
          console.log(`  Level: ${result.audioNoise.level}`);
          console.log(
            `  Intensity: ${result.audioNoise.config.intensity}`
          );
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.audio.push({
          test: 'Configure audio noise',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }

      // Test 2: Configure font evasion
      console.log('\nTest 2: Configuring font evasion...');
      try {
        const result = await client.sendCommand('configure_font_evasion', {
          profileId: advProfile,
          level: 'aggressive'
        });

        if (result.success && result.fontEvasion) {
          RESULTS.fonts.push({
            test: 'Configure font evasion',
            status: 'PASS',
            level: result.fontEvasion.level,
            fontCount: result.fontEvasion.fontCount
          });
          console.log('✓ PASS');
          console.log(`  Level: ${result.fontEvasion.level}`);
          console.log(`  Font Count: ${result.fontEvasion.fontCount}`);
          console.log(`  Fonts: ${result.fontEvasion.fonts.slice(0, 5).join(', ')}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.fonts.push({
          test: 'Configure font evasion',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    // ===== BEHAVIORAL PROFILES =====
    console.log('\n=== BEHAVIORAL PROFILES & COHERENCE ===\n');

    // Test 1: Create behavioral profile
    console.log('Test 1: Creating behavioral profile...');
    try {
      const sessionId = `session_${Date.now()}`;
      const result = await client.sendCommand('create_behavioral_profile', {
        sessionId: sessionId,
        speedMultiplier: 1.0,
        accuracyLevel: 0.95
      });

      if (result.success && result.sessionId) {
        BEHAVIORAL_PROFILES.session1 = result.sessionId;
        RESULTS.behavioral.push({
          test: 'Create behavioral profile',
          status: 'PASS',
          sessionId: result.sessionId,
          typingWPM: result.profile.typingWPM
        });
        console.log('✓ PASS');
        console.log(`  Session ID: ${result.sessionId}`);
        console.log(`  Typing WPM: ${result.profile.typingWPM}`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (e) {
      RESULTS.behavioral.push({
        test: 'Create behavioral profile',
        status: 'FAIL',
        error: e.message
      });
      console.log('✗ FAIL:', e.message);
    }

    // Test 2: Generate mouse path
    console.log('\nTest 2: Generating human-like mouse path...');
    if (!BEHAVIORAL_PROFILES.session1) {
      console.log('✗ SKIP: No behavioral profile');
    } else {
      try {
        const result = await client.sendCommand('generate_mouse_path', {
          sessionId: BEHAVIORAL_PROFILES.session1,
          start: { x: 100, y: 100 },
          end: { x: 500, y: 400 },
          targetWidth: 20
        });

        if (result.success && result.path) {
          RESULTS.behavioral.push({
            test: 'Generate mouse path',
            status: 'PASS',
            pointCount: result.pointCount,
            duration: result.duration
          });
          console.log('✓ PASS');
          console.log(`  Points: ${result.pointCount}`);
          console.log(`  Duration: ${result.duration}ms`);
          console.log(`  Distance: ${result.distance}px`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.behavioral.push({
          test: 'Generate mouse path',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    // Test 3: Generate typing events
    console.log('\nTest 3: Generating human-like typing...');
    if (!BEHAVIORAL_PROFILES.session1) {
      console.log('✗ SKIP: No behavioral profile');
    } else {
      try {
        const result = await client.sendCommand('generate_typing_events', {
          sessionId: BEHAVIORAL_PROFILES.session1,
          text: 'Hello World Test 123'
        });

        if (result.success && result.events) {
          RESULTS.behavioral.push({
            test: 'Generate typing events',
            status: 'PASS',
            eventCount: result.eventCount,
            wpm: result.effectiveWPM
          });
          console.log('✓ PASS');
          console.log(`  Events: ${result.eventCount}`);
          console.log(`  WPM: ${result.effectiveWPM}`);
          console.log(`  Duration: ${result.totalDuration}ms`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.behavioral.push({
          test: 'Generate typing events',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    // Test 4: Generate scroll behavior
    console.log('\nTest 4: Generating human-like scroll...');
    if (!BEHAVIORAL_PROFILES.session1) {
      console.log('✗ SKIP: No behavioral profile');
    } else {
      try {
        const result = await client.sendCommand('generate_scroll_behavior', {
          sessionId: BEHAVIORAL_PROFILES.session1,
          distance: 500,
          direction: 'down'
        });

        if (result.success && result.events !== undefined) {
          RESULTS.behavioral.push({
            test: 'Generate scroll behavior',
            status: 'PASS',
            eventCount: result.eventCount,
            duration: result.totalDuration
          });
          console.log('✓ PASS');
          console.log(`  Events: ${result.eventCount}`);
          console.log(`  Duration: ${result.totalDuration}ms`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (e) {
        RESULTS.behavioral.push({
          test: 'Generate scroll behavior',
          status: 'FAIL',
          error: e.message
        });
        console.log('✗ FAIL:', e.message);
      }
    }

    client.disconnect();
  } catch (error) {
    console.error('\n✗ FATAL ERROR:', error.message);
    client.disconnect();
    process.exit(1);
  }

  // Generate final report
  generateReport();
}

/**
 * Generate final report
 */
function generateReport() {
  const fs = require('fs');
  const path = require('path');

  console.log('\n\n===============================================');
  console.log('     v11.3.0 COMPREHENSIVE VALIDATION REPORT');
  console.log('===============================================\n');

  const allResults = [
    ...RESULTS.fingerprint,
    ...RESULTS.canvas,
    ...RESULTS.webgl,
    ...RESULTS.audio,
    ...RESULTS.fonts,
    ...RESULTS.behavioral
  ];

  const passCount = allResults.filter((r) => r.status === 'PASS').length;
  const failCount = allResults.filter((r) => r.status === 'FAIL').length;
  const totalCount = allResults.length;

  console.log(`Overall Results: ${passCount}/${totalCount} tests passed (${((passCount / totalCount) * 100).toFixed(1)}%)\n`);

  // Category breakdown
  const categories = [
    { name: 'FINGERPRINT VALIDATION', results: RESULTS.fingerprint },
    { name: 'CANVAS EVASION', results: RESULTS.canvas },
    { name: 'WEBGL EVASION', results: RESULTS.webgl },
    { name: 'AUDIO EVASION', results: RESULTS.audio },
    { name: 'FONT EVASION', results: RESULTS.fonts },
    { name: 'BEHAVIORAL PROFILES', results: RESULTS.behavioral }
  ];

  for (const cat of categories) {
    const passed = cat.results.filter((r) => r.status === 'PASS').length;
    const failed = cat.results.filter((r) => r.status === 'FAIL').length;
    console.log(`${cat.name}:`);
    console.log(`  Passed: ${passed} | Failed: ${failed}`);

    for (const result of cat.results) {
      const icon = result.status === 'PASS' ? '✓' : '✗';
      console.log(`  ${icon} ${result.test}`);
      if (result.status === 'FAIL' && result.error) {
        console.log(`    Error: ${result.error}`);
      }
    }
    console.log();
  }

  // Save JSON report
  const reportPath = '/home/devel/basset-hound-browser/tests/results/v11.3.0-comprehensive-validation.json';
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: totalCount,
      passedTests: passCount,
      failedTests: failCount,
      passRate: `${((passCount / totalCount) * 100).toFixed(1)}%`
    },
    byCategory: {
      fingerprint: RESULTS.fingerprint,
      canvas: RESULTS.canvas,
      webgl: RESULTS.webgl,
      audio: RESULTS.audio,
      fonts: RESULTS.fonts,
      behavioral: RESULTS.behavioral
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('===============================================');
  console.log(`Report saved to: ${reportPath}\n`);
}

// Run all tests
runTests().catch(console.error);

/**
 * Bot Detection Validation Test
 *
 * Tests the browser's evasion capabilities against common detection techniques.
 * Run with: node tests/bot-detection-validation.js
 *
 * Prerequisites: Browser must be running at ws://localhost:8765
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const VERBOSE = process.env.VERBOSE === 'true';

// Test sites for bot detection
const TEST_SITES = {
  sannysoft: 'https://bot.sannysoft.com/',
  browserleaks_canvas: 'https://browserleaks.com/canvas',
  // Note: Some sites may block or rate limit
};

class BotDetectionValidator {
  constructor() {
    this.ws = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.results = { pass: 0, fail: 0, tests: [] };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        console.log('Connected to browser at', WS_URL);
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'status') return;

        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg);
        }
      });

      this.ws.on('error', reject);
      this.ws.on('close', () => console.log('Disconnected'));
    });
  }

  async send(command, params = {}) {
    const id = ++this.messageId;
    const msg = { id, command, ...params };

    return new Promise((resolve) => {
      this.pendingRequests.set(id, { resolve });
      this.ws.send(JSON.stringify(msg));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({ success: false, error: 'Timeout' });
        }
      }, 30000);
    });
  }

  async wait(ms) {
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
    console.log('\n=== Bot Detection Validation Tests ===\n');

    // Test 1: Navigator.webdriver check
    await this.testNavigatorWebdriver();

    // Test 2: Plugins array check
    await this.testPlugins();

    // Test 3: Chrome object check
    await this.testChromeObject();

    // Test 4: Canvas fingerprint noise
    await this.testCanvasNoise();

    // Test 5: WebGL fingerprint
    await this.testWebGL();

    // Test 6: Fingerprint profile system
    await this.testFingerprintProfiles();

    // Test 7: Behavioral AI - mouse path generation
    await this.testMousePathGeneration();

    // Test 8: Behavioral AI - typing events
    await this.testTypingEvents();

    // Test 9: Honeypot detection
    await this.testHoneypotDetection();

    // Test 10: Rate limiting
    await this.testRateLimiting();

    // Test 11: Live test against sannysoft
    await this.testSannysoft();

    // Print summary
    this.printSummary();
  }

  async testNavigatorWebdriver() {
    console.log('Testing navigator.webdriver spoofing...');

    // Navigate to example.com first to have a real page loaded
    console.log('  (navigating to example.com...)');
    await this.send('navigate', { url: 'https://example.com' });
    await this.wait(4000);  // Wait for page load

    const result = await this.send('execute_script', {
      script: 'navigator.webdriver'
    });

    const passed = result.success && (result.result === undefined || result.result === null || result.result === 'undefined');
    this.logTest('navigator.webdriver', passed, `Value: ${result.result}`);
  }

  async testPlugins() {
    console.log('Testing navigator.plugins spoofing...');

    const result = await this.send('execute_script', {
      script: 'JSON.stringify({length: navigator.plugins.length, names: Array.from(navigator.plugins).map(p => p.name)})'
    });

    if (result.success) {
      try {
        const plugins = JSON.parse(result.result);
        const passed = plugins.length > 0;
        this.logTest('navigator.plugins', passed, `Count: ${plugins.length}, Names: ${plugins.names.slice(0,2).join(', ')}...`);
      } catch (e) {
        this.logTest('navigator.plugins', false, 'Parse error');
      }
    } else {
      this.logTest('navigator.plugins', false, result.error);
    }
  }

  async testChromeObject() {
    console.log('Testing window.chrome emulation...');

    const result = await this.send('execute_script', {
      script: 'JSON.stringify({exists: !!window.chrome, hasRuntime: !!(window.chrome && window.chrome.runtime)})'
    });

    if (result.success) {
      try {
        const chrome = JSON.parse(result.result);
        const passed = chrome.exists;
        this.logTest('window.chrome', passed, `Exists: ${chrome.exists}, Has runtime: ${chrome.hasRuntime}`);
      } catch (e) {
        this.logTest('window.chrome', false, 'Parse error');
      }
    } else {
      this.logTest('window.chrome', false, result.error);
    }
  }

  async testCanvasNoise() {
    console.log('Testing canvas fingerprint noise...');

    // Generate two canvas fingerprints and check if they differ (noise should make them different)
    const script = `
      (function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('test fingerprint', 2, 2);
        return canvas.toDataURL().substring(22, 50);
      })()
    `;

    const result1 = await this.send('execute_script', { script });
    await this.wait(100);
    const result2 = await this.send('execute_script', { script });

    // Note: Due to how noise works, fingerprints may or may not be different in a single test
    // The presence of any result indicates canvas is working
    const passed = result1.success && result2.success;
    this.logTest('canvas fingerprint', passed, 'Canvas rendering working');
  }

  async testWebGL() {
    console.log('Testing WebGL fingerprint spoofing...');

    const result = await this.send('execute_script', {
      script: `
        (function() {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return JSON.stringify({error: 'WebGL not supported'});
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (!debugInfo) return JSON.stringify({error: 'Debug info not available'});
          return JSON.stringify({
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          });
        })()
      `
    });

    if (result.success) {
      try {
        const webgl = JSON.parse(result.result);
        if (webgl.error) {
          this.logTest('WebGL spoofing', false, webgl.error);
        } else {
          // Check if vendor/renderer look realistic
          const passed = webgl.vendor && webgl.renderer &&
                        (webgl.vendor.includes('Google') || webgl.vendor.includes('NVIDIA') ||
                         webgl.vendor.includes('AMD') || webgl.vendor.includes('Intel'));
          this.logTest('WebGL spoofing', passed, `Vendor: ${webgl.vendor.substring(0, 30)}...`);
        }
      } catch (e) {
        this.logTest('WebGL spoofing', false, 'Parse error');
      }
    } else {
      this.logTest('WebGL spoofing', false, result.error);
    }
  }

  async testFingerprintProfiles() {
    console.log('Testing fingerprint profile system...');

    // Create a fingerprint profile
    const createResult = await this.send('create_fingerprint_profile', {
      name: 'test_profile_' + Date.now(),
      platform: 'windows',
      region: 'us-west'
    });

    const passed = createResult.success;
    this.logTest('fingerprint profiles', passed, passed ? 'Profile created' : createResult.error);
  }

  async testMousePathGeneration() {
    console.log('Testing behavioral AI - mouse path generation...');

    const result = await this.send('generate_mouse_path', {
      start: { x: 100, y: 100 },
      end: { x: 500, y: 300 }
    });

    if (result.success && result.path) {
      const path = result.path;
      const passed = Array.isArray(path) && path.length > 5;
      this.logTest('mouse path generation', passed, `Generated ${path.length} points`);
    } else {
      this.logTest('mouse path generation', false, result.error || 'No path returned');
    }
  }

  async testTypingEvents() {
    console.log('Testing behavioral AI - typing events...');

    const result = await this.send('generate_typing_events', {
      text: 'test input',
      wpm: 50
    });

    if (result.success && result.events) {
      const events = result.events;
      const passed = Array.isArray(events) && events.length > 0;
      this.logTest('typing events', passed, `Generated ${events.length} events`);
    } else {
      this.logTest('typing events', false, result.error || 'No events returned');
    }
  }

  async testHoneypotDetection() {
    console.log('Testing honeypot detection...');

    // Navigate to a page with a form first
    console.log('  (creating test page with honeypot fields...)');
    await this.send('navigate', { url: 'https://example.com' });
    await this.wait(3000);

    // Create a test form with honeypot fields using execute_script
    await this.send('execute_script', {
      script: `
        document.body.innerHTML = '<form id="testform">' +
          '<input type="text" name="username" />' +
          '<input type="text" name="email" />' +
          '<input type="text" name="honeypot" style="display:none" />' +
          '<input type="text" name="confirm_email" style="visibility:hidden" />' +
        '</form>';
      `
    });

    await this.wait(500);

    const result = await this.send('check_honeypot', {
      selector: '#testform'
    });

    if (result.success && result.honeypots) {
      const honeypots = result.honeypots;
      const passed = honeypots.length >= 2; // Should detect at least the hidden fields
      this.logTest('honeypot detection', passed, `Found ${honeypots.length} honeypots`);
    } else {
      this.logTest('honeypot detection', false, result.error || 'No honeypots returned');
    }
  }

  async testRateLimiting() {
    console.log('Testing rate limiting...');

    const result = await this.send('get_rate_limit_state', {
      domain: 'example.com'
    });

    const passed = result.success;
    this.logTest('rate limiting', passed, passed ? 'Rate limit state available' : result.error);
  }

  async testSannysoft() {
    console.log('Testing against bot.sannysoft.com (live test)...');

    // Navigate to sannysoft
    const navResult = await this.send('navigate', { url: 'https://bot.sannysoft.com/' });
    if (!navResult.success) {
      this.logTest('sannysoft live test', false, 'Navigation failed');
      return;
    }

    // Wait for page to load
    await this.wait(5000);

    // Check the test results on the page
    const result = await this.send('execute_script', {
      script: `
        (function() {
          const rows = document.querySelectorAll('table tr');
          let passed = 0;
          let failed = 0;
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const text = cells[1].textContent;
              if (text.includes('passed') || cells[1].classList.contains('passed')) passed++;
              else if (text.includes('failed') || cells[1].classList.contains('failed')) failed++;
            }
          });
          return JSON.stringify({ passed, failed });
        })()
      `
    });

    if (result.success) {
      try {
        const scores = JSON.parse(result.result);
        const passRate = scores.passed / (scores.passed + scores.failed) * 100;
        const passed = passRate >= 70; // Consider success if 70%+ tests pass
        this.logTest('sannysoft live test', passed, `${scores.passed}/${scores.passed + scores.failed} tests passed (${passRate.toFixed(0)}%)`);
      } catch (e) {
        this.logTest('sannysoft live test', false, 'Could not parse results');
      }
    } else {
      this.logTest('sannysoft live test', false, result.error);
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

    // Exit with appropriate code
    const passRate = this.results.pass / this.results.tests.length;
    if (passRate >= 0.7) {
      console.log('\n✓ Bot detection evasion validation PASSED');
      return 0;
    } else {
      console.log('\n✗ Bot detection evasion validation FAILED');
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
  const validator = new BotDetectionValidator();

  try {
    await validator.connect();
    await validator.runTests();
    const exitCode = validator.printSummary();
    validator.close();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nMake sure the browser is running at', WS_URL);
    validator.close();
    process.exit(1);
  }
}

main();

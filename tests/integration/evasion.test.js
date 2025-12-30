/**
 * Basset Hound Browser - Bot Detection Evasion Integration Tests
 * Tests for anti-bot detection and fingerprint evasion
 */

const path = require('path');
const WebSocket = require('ws');

// Skip in CI or when SKIP_INTEGRATION_TESTS is set (requires Electron and Playwright)
const shouldSkip = process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';

// Only require playwright/test when actually running tests
let electron;
if (!shouldSkip) {
  try {
    const playwright = require('@playwright/test');
    electron = playwright._electron;
  } catch (e) {
    // Playwright not available, will skip tests
  }
}

const APP_PATH = path.join(__dirname, '..', '..');
const WS_URL = 'ws://localhost:8765';

(shouldSkip ? describe.skip : describe)('Bot Detection Evasion Tests', () => {
  let electronApp;
  let window;
  let wsClient;
  let messageId = 1;

  /**
   * Connect to WebSocket server
   */
  async function connectWebSocket() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.once('message', () => resolve(ws));
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Send command and wait for response
   */
  function sendCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = `test-${Date.now()}-${messageId++}`;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, 30000);

      const handler = (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          ws.off('message', handler);
          resolve(response);
        }
      };

      ws.on('message', handler);
      ws.send(JSON.stringify({ id, command, ...params }));
    });
  }

  /**
   * Execute script and return result
   */
  async function executeScript(script) {
    const response = await sendCommand(wsClient, 'execute_script', { script });
    if (!response.success) {
      throw new Error(response.error || 'Script execution failed');
    }
    return response.result;
  }

  beforeAll(async () => {
    jest.setTimeout(120000);
  });

  beforeEach(async () => {
    electronApp = await electron.launch({
      args: [APP_PATH]
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for WebSocket server to start
    await new Promise(r => setTimeout(r, 2000));

    wsClient = await connectWebSocket();

    // Navigate to a test page
    await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
    await new Promise(r => setTimeout(r, 2000));
  });

  afterEach(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (electronApp) {
      await electronApp.close();
    }
  });

  describe('WebDriver Detection', () => {
    test('navigator.webdriver should be undefined or false', async () => {
      const result = await executeScript('return navigator.webdriver');
      expect(result === undefined || result === null || result === false).toBe(true);
    });

    test('webdriver property should not exist on navigator', async () => {
      const result = await executeScript(`
        return 'webdriver' in navigator && navigator.webdriver === true
      `);
      expect(result).toBe(false);
    });
  });

  describe('Selenium Detection', () => {
    test('window._selenium should not exist', async () => {
      const result = await executeScript(`
        return typeof window._selenium === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('window.callSelenium should not exist', async () => {
      const result = await executeScript(`
        return typeof window.callSelenium === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('$cdc_ properties should not exist', async () => {
      const result = await executeScript(`
        const keys = Object.keys(document);
        return !keys.some(key => key.startsWith('$cdc_'));
      `);
      expect(result).toBe(true);
    });

    test('window.domAutomation should not exist', async () => {
      const result = await executeScript(`
        return typeof window.domAutomation === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('window.domAutomationController should not exist', async () => {
      const result = await executeScript(`
        return typeof window.domAutomationController === 'undefined'
      `);
      expect(result).toBe(true);
    });
  });

  describe('Phantom Detection', () => {
    test('window._phantom should not exist', async () => {
      const result = await executeScript(`
        return typeof window._phantom === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('window.callPhantom should not exist', async () => {
      const result = await executeScript(`
        return typeof window.callPhantom === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('window.__nightmare should not exist', async () => {
      const result = await executeScript(`
        return typeof window.__nightmare === 'undefined'
      `);
      expect(result).toBe(true);
    });
  });

  describe('WebDriver Script Functions', () => {
    test('document.__webdriver_script_fn should not exist', async () => {
      const result = await executeScript(`
        return typeof document.__webdriver_script_fn === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('document.__webdriver_script_func should not exist', async () => {
      const result = await executeScript(`
        return typeof document.__webdriver_script_func === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('document.__driver_evaluate should not exist', async () => {
      const result = await executeScript(`
        return typeof document.__driver_evaluate === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('document.__webdriver_evaluate should not exist', async () => {
      const result = await executeScript(`
        return typeof document.__webdriver_evaluate === 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('document.__selenium_evaluate should not exist', async () => {
      const result = await executeScript(`
        return typeof document.__selenium_evaluate === 'undefined'
      `);
      expect(result).toBe(true);
    });
  });

  describe('Navigator Properties', () => {
    test('navigator.plugins should exist and have items', async () => {
      const result = await executeScript(`
        return navigator.plugins && navigator.plugins.length > 0
      `);
      expect(result).toBe(true);
    });

    test('navigator.plugins should contain common plugins', async () => {
      const result = await executeScript(`
        const pluginNames = Array.from(navigator.plugins).map(p => p.name);
        return pluginNames.some(name =>
          name.includes('PDF') ||
          name.includes('Chrome') ||
          name.includes('Native')
        );
      `);
      expect(result).toBe(true);
    });

    test('navigator.mimeTypes should exist', async () => {
      const result = await executeScript(`
        return navigator.mimeTypes && navigator.mimeTypes.length > 0
      `);
      expect(result).toBe(true);
    });

    test('navigator.languages should exist and be non-empty', async () => {
      const result = await executeScript(`
        return navigator.languages && navigator.languages.length > 0
      `);
      expect(result).toBe(true);
    });

    test('navigator.language should be valid', async () => {
      const result = await executeScript(`
        return navigator.language && navigator.language.length >= 2
      `);
      expect(result).toBe(true);
    });

    test('navigator.platform should be valid', async () => {
      const result = await executeScript(`
        const validPlatforms = ['Win32', 'MacIntel', 'Linux x86_64', 'Linux armv7l', 'iPhone', 'iPad'];
        return validPlatforms.some(p => navigator.platform.includes(p) || p.includes(navigator.platform));
      `);
      expect(result).toBe(true);
    });

    test('navigator.deviceMemory should be defined', async () => {
      const result = await executeScript(`
        return typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0
      `);
      expect(result).toBe(true);
    });

    test('navigator.hardwareConcurrency should be valid', async () => {
      const result = await executeScript(`
        return typeof navigator.hardwareConcurrency === 'number' &&
               navigator.hardwareConcurrency >= 1 &&
               navigator.hardwareConcurrency <= 128
      `);
      expect(result).toBe(true);
    });
  });

  describe('Window Chrome Object', () => {
    test('window.chrome should exist', async () => {
      const result = await executeScript(`
        return typeof window.chrome !== 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('window.chrome.runtime should exist', async () => {
      const result = await executeScript(`
        return window.chrome && typeof window.chrome.runtime !== 'undefined'
      `);
      expect(result).toBe(true);
    });
  });

  describe('Permissions API', () => {
    test('Permissions API should work', async () => {
      const result = await executeScript(`
        return new Promise(resolve => {
          navigator.permissions.query({name: 'notifications'})
            .then(() => resolve(true))
            .catch(() => resolve(false));
        });
      `);
      expect(result).toBe(true);
    });

    test('Permissions should not reveal automation', async () => {
      const result = await executeScript(`
        return new Promise(resolve => {
          navigator.permissions.query({name: 'notifications'})
            .then(status => {
              // Should return 'prompt', 'granted', or 'denied' - not something unusual
              resolve(['prompt', 'granted', 'denied'].includes(status.state));
            })
            .catch(() => resolve(true)); // Permission not supported is also OK
        });
      `);
      expect(result).toBe(true);
    });
  });

  describe('Screen Properties', () => {
    test('screen.width should be valid', async () => {
      const result = await executeScript(`
        return screen.width > 0 && screen.width <= 10000
      `);
      expect(result).toBe(true);
    });

    test('screen.height should be valid', async () => {
      const result = await executeScript(`
        return screen.height > 0 && screen.height <= 10000
      `);
      expect(result).toBe(true);
    });

    test('screen.availWidth should be valid', async () => {
      const result = await executeScript(`
        return screen.availWidth > 0 && screen.availWidth <= screen.width
      `);
      expect(result).toBe(true);
    });

    test('screen.availHeight should be valid', async () => {
      const result = await executeScript(`
        return screen.availHeight > 0 && screen.availHeight <= screen.height
      `);
      expect(result).toBe(true);
    });

    test('screen.colorDepth should be valid', async () => {
      const result = await executeScript(`
        return [24, 30, 32].includes(screen.colorDepth)
      `);
      expect(result).toBe(true);
    });

    test('screen.pixelDepth should match colorDepth', async () => {
      const result = await executeScript(`
        return screen.pixelDepth === screen.colorDepth
      `);
      expect(result).toBe(true);
    });
  });

  describe('User Agent', () => {
    test('user agent should look realistic', async () => {
      const result = await executeScript(`
        const ua = navigator.userAgent;
        return ua.includes('Chrome') || ua.includes('Firefox') || ua.includes('Safari');
      `);
      expect(result).toBe(true);
    });

    test('user agent should include browser version', async () => {
      const result = await executeScript(`
        const ua = navigator.userAgent;
        return /Chrome\\/\\d+|Firefox\\/\\d+|Safari\\/\\d+/.test(ua);
      `);
      expect(result).toBe(true);
    });

    test('user agent should include OS', async () => {
      const result = await executeScript(`
        const ua = navigator.userAgent;
        return ua.includes('Windows') || ua.includes('Macintosh') || ua.includes('Linux');
      `);
      expect(result).toBe(true);
    });

    test('user agent should not contain automation keywords', async () => {
      const result = await executeScript(`
        const ua = navigator.userAgent.toLowerCase();
        return !ua.includes('headless') && !ua.includes('phantomjs') &&
               !ua.includes('selenium') && !ua.includes('webdriver');
      `);
      expect(result).toBe(true);
    });
  });

  describe('WebGL Fingerprinting', () => {
    test('WebGL vendor should return string', async () => {
      const result = await executeScript(`
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (!gl) return true; // WebGL not supported is OK
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (!debugInfo) return true; // Extension not supported is OK
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          return typeof vendor === 'string' && vendor.length > 0;
        } catch {
          return true; // Error handling is OK
        }
      `);
      expect(result).toBe(true);
    });

    test('WebGL renderer should return string', async () => {
      const result = await executeScript(`
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (!gl) return true;
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (!debugInfo) return true;
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          return typeof renderer === 'string' && renderer.length > 0;
        } catch {
          return true;
        }
      `);
      expect(result).toBe(true);
    });

    test('WebGL vendor should not be empty or generic', async () => {
      const result = await executeScript(`
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (!gl) return true;
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (!debugInfo) return true;
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          return vendor !== '' && vendor !== 'WebKit' && vendor !== 'Mozilla';
        } catch {
          return true;
        }
      `);
      expect(result).toBe(true);
    });
  });

  describe('Canvas Fingerprinting', () => {
    test('canvas should work and produce data', async () => {
      const result = await executeScript(`
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('test', 0, 0);
          return canvas.toDataURL().length > 0;
        } catch {
          return false;
        }
      `);
      expect(result).toBe(true);
    });

    test('canvas.toBlob should work', async () => {
      const result = await executeScript(`
        return new Promise(resolve => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillRect(0, 0, 10, 10);
            canvas.toBlob(blob => {
              resolve(blob !== null);
            });
          } catch {
            resolve(false);
          }
        });
      `);
      expect(result).toBe(true);
    });
  });

  describe('Audio Fingerprinting', () => {
    test('AudioContext should be available', async () => {
      const result = await executeScript(`
        return typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined'
      `);
      expect(result).toBe(true);
    });

    test('AudioContext should create oscillator', async () => {
      const result = await executeScript(`
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext();
          const oscillator = ctx.createOscillator();
          ctx.close();
          return oscillator !== null;
        } catch {
          return true; // May be blocked by autoplay policy
        }
      `);
      expect(result).toBe(true);
    });
  });

  describe('Timezone', () => {
    test('timezone offset should be valid', async () => {
      const result = await executeScript(`
        const offset = new Date().getTimezoneOffset();
        return typeof offset === 'number' && offset >= -720 && offset <= 720;
      `);
      expect(result).toBe(true);
    });

    test('Intl.DateTimeFormat should return valid timezone', async () => {
      const result = await executeScript(`
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          return typeof tz === 'string' && tz.length > 0;
        } catch {
          return true;
        }
      `);
      expect(result).toBe(true);
    });
  });

  describe('Iframe Detection', () => {
    test('iframe contentWindow should have consistent navigator', async () => {
      const result = await executeScript(`
        return new Promise(resolve => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          setTimeout(() => {
            try {
              const iframeNav = iframe.contentWindow.navigator;
              const sameWebdriver = iframeNav.webdriver === navigator.webdriver;
              const samePlugins = iframeNav.plugins.length === navigator.plugins.length;
              document.body.removeChild(iframe);
              resolve(sameWebdriver && samePlugins);
            } catch {
              document.body.removeChild(iframe);
              resolve(true);
            }
          }, 100);
        });
      `);
      expect(result).toBe(true);
    });
  });

  describe('toString Checks', () => {
    test('navigator.plugins.toString should be native', async () => {
      const result = await executeScript(`
        const str = navigator.plugins.toString();
        return str === '[object PluginArray]';
      `);
      expect(result).toBe(true);
    });

    test('Function.prototype.toString should not be modified', async () => {
      const result = await executeScript(`
        return Function.prototype.toString.toString().includes('native code');
      `);
      expect(result).toBe(true);
    });
  });

  describe('Consistency Checks', () => {
    test('all checks should pass consistently', async () => {
      // Run all key checks and verify they all pass
      const checks = await executeScript(`
        const results = {
          webdriver: navigator.webdriver === undefined || navigator.webdriver === false,
          plugins: navigator.plugins && navigator.plugins.length > 0,
          languages: navigator.languages && navigator.languages.length > 0,
          chrome: typeof window.chrome !== 'undefined',
          noSelenium: typeof window._selenium === 'undefined',
          noPhantom: typeof window._phantom === 'undefined',
          screenWidth: screen.width > 0,
          screenHeight: screen.height > 0
        };
        return results;
      `);

      expect(checks.webdriver).toBe(true);
      expect(checks.plugins).toBe(true);
      expect(checks.languages).toBe(true);
      expect(checks.chrome).toBe(true);
      expect(checks.noSelenium).toBe(true);
      expect(checks.noPhantom).toBe(true);
      expect(checks.screenWidth).toBe(true);
      expect(checks.screenHeight).toBe(true);
    });
  });
});

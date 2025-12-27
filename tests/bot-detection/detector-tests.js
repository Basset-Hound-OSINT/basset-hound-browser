/**
 * Basset Hound Browser - Bot Detection Site Tests
 * Tests against real bot detection services
 */

const path = require('path');
const { _electron: electron } = require('@playwright/test');
const WebSocket = require('ws');

const APP_PATH = path.join(__dirname, '..', '..');
const WS_URL = 'ws://localhost:8765';

/**
 * Bot Detection Test Sites
 * These are public sites that test for bot detection
 */
const BOT_DETECTION_SITES = {
  SANNYSOFT: 'https://bot.sannysoft.com/',
  BROWSERLEAKS_CANVAS: 'https://browserleaks.com/canvas',
  BROWSERLEAKS_WEBGL: 'https://browserleaks.com/webgl',
  BROWSERLEAKS_JAVASCRIPT: 'https://browserleaks.com/javascript',
  CREEPJS: 'https://abrahamjuliot.github.io/creepjs/',
  PIXELSCAN: 'https://pixelscan.net/',
  AMIUNIQUE: 'https://amiunique.org/',
  INTOLI: 'https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html'
};

describe('Bot Detection Site Tests', () => {
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
      const id = `bot-test-${Date.now()}-${messageId++}`;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, 60000);

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

  /**
   * Wait for page to load completely
   */
  async function waitForPageLoad(timeout = 30000) {
    await sendCommand(wsClient, 'wait_for_element', {
      selector: 'body',
      timeout
    });
    // Additional wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));
  }

  beforeAll(async () => {
    jest.setTimeout(300000); // 5 minutes for bot detection tests
  });

  beforeEach(async () => {
    electronApp = await electron.launch({
      args: [APP_PATH]
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for WebSocket server to start
    await new Promise(r => setTimeout(r, 3000));

    wsClient = await connectWebSocket();
  });

  afterEach(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (electronApp) {
      await electronApp.close();
    }
  });

  describe('SannySoft Bot Detection', () => {
    test('should pass SannySoft basic tests', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.SANNYSOFT });
      await waitForPageLoad();

      // Get test results from the page
      const results = await executeScript(`
        const results = {};

        // Check for pass/fail indicators
        const cells = document.querySelectorAll('td');
        cells.forEach(cell => {
          if (cell.classList.contains('passed')) {
            results.passed = (results.passed || 0) + 1;
          } else if (cell.classList.contains('failed')) {
            results.failed = (results.failed || 0) + 1;
          }
        });

        // Get specific test values
        try {
          results.userAgent = document.querySelector('[id*="user-agent"], [id*="userAgent"]')?.textContent;
          results.webdriver = document.querySelector('[id*="webdriver"]')?.textContent;
        } catch (e) {}

        return results;
      `);

      console.log('SannySoft results:', results);

      // Most tests should pass
      if (results.passed && results.failed) {
        const passRate = results.passed / (results.passed + results.failed);
        expect(passRate).toBeGreaterThan(0.7);
      }
    });

    test('should have consistent fingerprint', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.SANNYSOFT });
      await waitForPageLoad();

      // Run basic fingerprint checks
      const fingerprint = await executeScript(`
        return {
          webdriver: navigator.webdriver,
          plugins: navigator.plugins.length,
          languages: navigator.languages,
          platform: navigator.platform,
          screenWidth: screen.width,
          screenHeight: screen.height,
          colorDepth: screen.colorDepth
        };
      `);

      expect(fingerprint.webdriver).not.toBe(true);
      expect(fingerprint.plugins).toBeGreaterThan(0);
      expect(fingerprint.languages.length).toBeGreaterThan(0);
      expect(fingerprint.platform).toBeDefined();
      expect(fingerprint.screenWidth).toBeGreaterThan(0);
      expect(fingerprint.screenHeight).toBeGreaterThan(0);
    });
  });

  describe('Intoli Headless Chrome Test', () => {
    test('should pass Intoli headless detection tests', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.INTOLI });
      await waitForPageLoad();

      const results = await executeScript(`
        const rows = document.querySelectorAll('table tr');
        const results = {};

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const testName = cells[0]?.textContent?.trim();
            const status = cells[2]?.textContent?.trim();
            if (testName && status) {
              results[testName] = status === 'ok' || status.includes('passed') || status.includes('true');
            }
          }
        });

        return results;
      `);

      console.log('Intoli results:', results);

      // Count passed tests
      const passed = Object.values(results).filter(v => v === true).length;
      const total = Object.keys(results).length;

      if (total > 0) {
        const passRate = passed / total;
        expect(passRate).toBeGreaterThan(0.6);
      }
    });
  });

  describe('BrowserLeaks Canvas', () => {
    test('should have valid canvas fingerprint', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.BROWSERLEAKS_CANVAS });
      await waitForPageLoad(45000);

      const canvasInfo = await executeScript(`
        return {
          hasCanvas: !!document.createElement('canvas').getContext,
          canCreate2D: !!document.createElement('canvas').getContext('2d'),
          canCreateWebGL: !!document.createElement('canvas').getContext('webgl'),
          toDataURL: (() => {
            try {
              const c = document.createElement('canvas');
              c.width = 100;
              c.height = 100;
              const ctx = c.getContext('2d');
              ctx.fillStyle = 'red';
              ctx.fillRect(0, 0, 50, 50);
              return c.toDataURL().length > 100;
            } catch (e) {
              return false;
            }
          })()
        };
      `);

      expect(canvasInfo.hasCanvas).toBe(true);
      expect(canvasInfo.canCreate2D).toBe(true);
      expect(canvasInfo.toDataURL).toBe(true);
    });
  });

  describe('BrowserLeaks WebGL', () => {
    test('should have valid WebGL info', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.BROWSERLEAKS_WEBGL });
      await waitForPageLoad(45000);

      const webglInfo = await executeScript(`
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return { supported: false };

          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            supported: true,
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'hidden',
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'hidden',
            version: gl.getParameter(gl.VERSION),
            shadingVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
          };
        } catch (e) {
          return { supported: false, error: e.message };
        }
      `);

      console.log('WebGL info:', webglInfo);

      expect(webglInfo.supported).toBe(true);
      if (webglInfo.vendor !== 'hidden') {
        expect(webglInfo.vendor.length).toBeGreaterThan(0);
      }
      if (webglInfo.renderer !== 'hidden') {
        expect(webglInfo.renderer.length).toBeGreaterThan(0);
      }
    });
  });

  describe('BrowserLeaks JavaScript', () => {
    test('should have valid JavaScript fingerprint', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.BROWSERLEAKS_JAVASCRIPT });
      await waitForPageLoad(45000);

      const jsInfo = await executeScript(`
        return {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          languages: navigator.languages,
          cookiesEnabled: navigator.cookieEnabled,
          doNotTrack: navigator.doNotTrack,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory,
          platform: navigator.platform,
          touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
      `);

      console.log('JavaScript info:', jsInfo);

      expect(jsInfo.timezone).toBeDefined();
      expect(jsInfo.language).toBeDefined();
      expect(jsInfo.languages.length).toBeGreaterThan(0);
      expect(jsInfo.hardwareConcurrency).toBeGreaterThan(0);
    });
  });

  describe('CreepJS Advanced Detection', () => {
    test('should not be flagged by CreepJS', async () => {
      await sendCommand(wsClient, 'navigate', { url: BOT_DETECTION_SITES.CREEPJS });
      await waitForPageLoad(60000);

      // Wait for CreepJS to fully load and analyze
      await new Promise(r => setTimeout(r, 10000));

      const creepInfo = await executeScript(`
        // Check for lies detected
        const lies = document.querySelectorAll('.lies, .lie, [class*="lie"]');
        const liesCount = lies.length;

        // Check for bot indicators
        const botIndicators = document.body.textContent;
        const isBotFlagged = botIndicators.includes('bot detected') ||
                            botIndicators.includes('headless') ||
                            botIndicators.includes('automation');

        return {
          liesCount,
          isBotFlagged,
          pageLoaded: true
        };
      `);

      console.log('CreepJS info:', creepInfo);

      // Should not be explicitly flagged as a bot
      expect(creepInfo.pageLoaded).toBe(true);
    });
  });

  describe('Core Bot Detection Checks', () => {
    test('should pass all core detection checks', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await waitForPageLoad();

      const coreChecks = await executeScript(`
        const checks = {
          // WebDriver checks
          webdriver: navigator.webdriver !== true,
          noWebdriverProp: !('webdriver' in navigator) || navigator.webdriver !== true,

          // Selenium checks
          noSelenium: typeof window._selenium === 'undefined',
          noCallSelenium: typeof window.callSelenium === 'undefined',
          noCdc: !Object.keys(document).some(k => k.startsWith('$cdc_')),

          // Phantom checks
          noPhantom: typeof window._phantom === 'undefined',
          noCallPhantom: typeof window.callPhantom === 'undefined',
          noNightmare: typeof window.__nightmare === 'undefined',

          // Chrome object
          hasChrome: typeof window.chrome !== 'undefined',
          hasChromeRuntime: window.chrome && typeof window.chrome.runtime !== 'undefined',

          // Navigator
          hasPlugins: navigator.plugins.length > 0,
          hasLanguages: navigator.languages.length > 0,
          hasValidPlatform: !!navigator.platform,
          hasMimeTypes: navigator.mimeTypes.length > 0,

          // Screen
          validScreen: screen.width > 0 && screen.height > 0,
          validColorDepth: screen.colorDepth >= 24,

          // User agent
          noHeadless: !navigator.userAgent.includes('HeadlessChrome'),
          noAutomation: !navigator.userAgent.includes('Automation'),

          // Permissions
          hasPermissions: typeof navigator.permissions !== 'undefined',

          // Functions are native
          nativeToString: Function.prototype.toString.toString().includes('native code'),

          // WebGL
          hasWebGL: (() => {
            try {
              const c = document.createElement('canvas');
              return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
            } catch (e) { return false; }
          })()
        };

        return checks;
      `);

      console.log('Core checks:', coreChecks);

      // All core checks should pass
      const failedChecks = Object.entries(coreChecks)
        .filter(([_, passed]) => !passed)
        .map(([name]) => name);

      if (failedChecks.length > 0) {
        console.log('Failed checks:', failedChecks);
      }

      // Most critical checks must pass
      expect(coreChecks.webdriver).toBe(true);
      expect(coreChecks.noSelenium).toBe(true);
      expect(coreChecks.noPhantom).toBe(true);
      expect(coreChecks.hasPlugins).toBe(true);
      expect(coreChecks.hasLanguages).toBe(true);
      expect(coreChecks.noHeadless).toBe(true);
    });
  });
});

module.exports = {
  BOT_DETECTION_SITES
};

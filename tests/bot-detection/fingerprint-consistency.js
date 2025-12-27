/**
 * Basset Hound Browser - Fingerprint Consistency Tests
 * Tests to verify fingerprint values are consistent and realistic
 */

const path = require('path');
const { _electron: electron } = require('@playwright/test');
const WebSocket = require('ws');

const APP_PATH = path.join(__dirname, '..', '..');
const WS_URL = 'ws://localhost:8765';

describe('Fingerprint Consistency Tests', () => {
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
      const id = `fp-test-${Date.now()}-${messageId++}`;
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

  /**
   * Collect comprehensive fingerprint
   */
  async function collectFingerprint() {
    return await executeScript(`
      const fingerprint = {};

      // Navigator properties
      fingerprint.navigator = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: [...navigator.languages],
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints,
        webdriver: navigator.webdriver,
        vendor: navigator.vendor,
        appVersion: navigator.appVersion,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        pluginsLength: navigator.plugins.length,
        mimeTypesLength: navigator.mimeTypes.length
      };

      // Screen properties
      fingerprint.screen = {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth
      };

      // Window properties
      fingerprint.window = {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        devicePixelRatio: window.devicePixelRatio
      };

      // Timezone
      fingerprint.timezone = {
        offset: new Date().getTimezoneOffset(),
        name: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      // WebGL
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          fingerprint.webgl = {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'not available',
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'not available',
            version: gl.getParameter(gl.VERSION),
            shadingVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
          };
        }
      } catch (e) {
        fingerprint.webgl = { error: e.message };
      }

      // Canvas fingerprint
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Fingerprint Test', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint Test', 4, 17);
        fingerprint.canvas = {
          hash: canvas.toDataURL().slice(-50),
          length: canvas.toDataURL().length
        };
      } catch (e) {
        fingerprint.canvas = { error: e.message };
      }

      // AudioContext
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        fingerprint.audio = {
          supported: !!AudioContext,
          sampleRate: new AudioContext().sampleRate
        };
      } catch (e) {
        fingerprint.audio = { supported: false, error: e.message };
      }

      // Chrome object
      fingerprint.chrome = {
        exists: typeof window.chrome !== 'undefined',
        runtime: window.chrome && typeof window.chrome.runtime !== 'undefined'
      };

      // Plugins info
      fingerprint.plugins = Array.from(navigator.plugins).map(p => ({
        name: p.name,
        filename: p.filename
      }));

      return fingerprint;
    `);
  }

  beforeAll(async () => {
    jest.setTimeout(180000);
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

  describe('Navigator Consistency', () => {
    test('should have consistent navigator properties', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // User agent consistency
      expect(fp.navigator.userAgent).toBeDefined();
      expect(fp.navigator.userAgent.length).toBeGreaterThan(50);

      // User agent should match platform
      const ua = fp.navigator.userAgent;
      const platform = fp.navigator.platform;

      if (platform.includes('Win')) {
        expect(ua).toContain('Windows');
      } else if (platform.includes('Mac')) {
        expect(ua).toContain('Macintosh');
      } else if (platform.includes('Linux')) {
        expect(ua).toContain('Linux');
      }

      // WebDriver must be undefined or false
      expect(fp.navigator.webdriver === undefined || fp.navigator.webdriver === null || fp.navigator.webdriver === false).toBe(true);

      // Plugins must exist
      expect(fp.navigator.pluginsLength).toBeGreaterThan(0);

      // MimeTypes should exist
      expect(fp.navigator.mimeTypesLength).toBeGreaterThan(0);

      // Languages should be valid
      expect(fp.navigator.languages.length).toBeGreaterThan(0);
      expect(fp.navigator.language).toBe(fp.navigator.languages[0]);
    });

    test('should have realistic hardware concurrency', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Hardware concurrency should be reasonable
      expect(fp.navigator.hardwareConcurrency).toBeGreaterThanOrEqual(1);
      expect(fp.navigator.hardwareConcurrency).toBeLessThanOrEqual(128);

      // Device memory should be reasonable
      if (fp.navigator.deviceMemory !== undefined) {
        expect(fp.navigator.deviceMemory).toBeGreaterThanOrEqual(0.25);
        expect(fp.navigator.deviceMemory).toBeLessThanOrEqual(256);
      }
    });
  });

  describe('Screen Consistency', () => {
    test('should have consistent screen properties', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Screen dimensions should be positive
      expect(fp.screen.width).toBeGreaterThan(0);
      expect(fp.screen.height).toBeGreaterThan(0);

      // Available dimensions should be <= total
      expect(fp.screen.availWidth).toBeLessThanOrEqual(fp.screen.width);
      expect(fp.screen.availHeight).toBeLessThanOrEqual(fp.screen.height);

      // Color depth should be valid
      expect([24, 30, 32]).toContain(fp.screen.colorDepth);

      // Pixel depth should match color depth
      expect(fp.screen.pixelDepth).toBe(fp.screen.colorDepth);
    });

    test('should have realistic screen dimensions', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Screen should be realistic size
      expect(fp.screen.width).toBeGreaterThanOrEqual(1024);
      expect(fp.screen.width).toBeLessThanOrEqual(7680); // 8K max
      expect(fp.screen.height).toBeGreaterThanOrEqual(600);
      expect(fp.screen.height).toBeLessThanOrEqual(4320); // 8K max
    });
  });

  describe('Window Consistency', () => {
    test('should have consistent window dimensions', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Window dimensions should be positive
      expect(fp.window.innerWidth).toBeGreaterThan(0);
      expect(fp.window.innerHeight).toBeGreaterThan(0);
      expect(fp.window.outerWidth).toBeGreaterThan(0);
      expect(fp.window.outerHeight).toBeGreaterThan(0);

      // Outer should be >= inner
      expect(fp.window.outerWidth).toBeGreaterThanOrEqual(fp.window.innerWidth);
      expect(fp.window.outerHeight).toBeGreaterThanOrEqual(fp.window.innerHeight);

      // Device pixel ratio should be valid
      expect(fp.window.devicePixelRatio).toBeGreaterThanOrEqual(1);
      expect(fp.window.devicePixelRatio).toBeLessThanOrEqual(5);
    });
  });

  describe('Timezone Consistency', () => {
    test('should have consistent timezone', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Offset should be valid
      expect(fp.timezone.offset).toBeGreaterThanOrEqual(-720);
      expect(fp.timezone.offset).toBeLessThanOrEqual(720);

      // Timezone name should be valid IANA format
      expect(fp.timezone.name).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$/);
    });
  });

  describe('WebGL Consistency', () => {
    test('should have consistent WebGL properties', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      if (fp.webgl && !fp.webgl.error) {
        // Vendor and renderer should not be empty
        if (fp.webgl.vendor !== 'not available') {
          expect(fp.webgl.vendor.length).toBeGreaterThan(0);
        }
        if (fp.webgl.renderer !== 'not available') {
          expect(fp.webgl.renderer.length).toBeGreaterThan(0);
        }

        // Version should be defined
        expect(fp.webgl.version).toBeDefined();
      }
    });
  });

  describe('Canvas Consistency', () => {
    test('should produce consistent canvas fingerprint', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp1 = await collectFingerprint();

      // Collect again
      const fp2 = await collectFingerprint();

      if (!fp1.canvas.error && !fp2.canvas.error) {
        // Canvas fingerprint should be consistent within same session
        expect(fp1.canvas.length).toBe(fp2.canvas.length);
        expect(fp1.canvas.hash).toBe(fp2.canvas.hash);
      }
    });
  });

  describe('Audio Consistency', () => {
    test('should have consistent audio properties', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      if (fp.audio.supported) {
        // Sample rate should be valid
        expect([44100, 48000, 96000]).toContain(fp.audio.sampleRate);
      }
    });
  });

  describe('Chrome Object Consistency', () => {
    test('should have chrome object', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Chrome object should exist
      expect(fp.chrome.exists).toBe(true);
      expect(fp.chrome.runtime).toBe(true);
    });
  });

  describe('Plugins Consistency', () => {
    test('should have realistic plugins', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const fp = await collectFingerprint();

      // Should have some plugins
      expect(fp.plugins.length).toBeGreaterThan(0);

      // Check for common plugins
      const pluginNames = fp.plugins.map(p => p.name);
      const hasCommonPlugin = pluginNames.some(name =>
        name.includes('PDF') ||
        name.includes('Chrome') ||
        name.includes('Native')
      );
      expect(hasCommonPlugin).toBe(true);
    });
  });

  describe('Cross-Page Consistency', () => {
    test('should maintain consistent fingerprint across pages', async () => {
      // First page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));
      const fp1 = await collectFingerprint();

      // Second page
      await sendCommand(wsClient, 'navigate', { url: 'https://www.iana.org/' });
      await new Promise(r => setTimeout(r, 2000));
      const fp2 = await collectFingerprint();

      // Navigator properties should be consistent
      expect(fp1.navigator.userAgent).toBe(fp2.navigator.userAgent);
      expect(fp1.navigator.platform).toBe(fp2.navigator.platform);
      expect(fp1.navigator.hardwareConcurrency).toBe(fp2.navigator.hardwareConcurrency);

      // Screen properties should be consistent
      expect(fp1.screen.width).toBe(fp2.screen.width);
      expect(fp1.screen.height).toBe(fp2.screen.height);
      expect(fp1.screen.colorDepth).toBe(fp2.screen.colorDepth);

      // WebGL should be consistent
      if (!fp1.webgl.error && !fp2.webgl.error) {
        expect(fp1.webgl.vendor).toBe(fp2.webgl.vendor);
        expect(fp1.webgl.renderer).toBe(fp2.webgl.renderer);
      }

      // Timezone should be consistent
      expect(fp1.timezone.offset).toBe(fp2.timezone.offset);
      expect(fp1.timezone.name).toBe(fp2.timezone.name);
    });
  });

  describe('Iframe Consistency', () => {
    test('should maintain consistent fingerprint in iframes', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const result = await executeScript(`
        return new Promise(resolve => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);

          setTimeout(() => {
            try {
              const main = {
                webdriver: navigator.webdriver,
                plugins: navigator.plugins.length,
                languages: [...navigator.languages],
                platform: navigator.platform
              };

              const iframeNav = iframe.contentWindow.navigator;
              const iframeData = {
                webdriver: iframeNav.webdriver,
                plugins: iframeNav.plugins.length,
                languages: [...iframeNav.languages],
                platform: iframeNav.platform
              };

              document.body.removeChild(iframe);

              resolve({
                main,
                iframe: iframeData,
                match: JSON.stringify(main) === JSON.stringify(iframeData)
              });
            } catch (e) {
              document.body.removeChild(iframe);
              resolve({ error: e.message });
            }
          }, 100);
        });
      `);

      if (!result.error) {
        // Main and iframe should have matching fingerprints
        expect(result.main.webdriver).toBe(result.iframe.webdriver);
        expect(result.main.plugins).toBe(result.iframe.plugins);
        expect(result.main.platform).toBe(result.iframe.platform);
      }
    });
  });
});

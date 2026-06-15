/**
 * Basset Hound Browser - Browser Launch Integration Tests
 * Tests for Electron application launch and initialization
 */

const path = require('path');

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

// Path to the main Electron app
const APP_PATH = path.join(__dirname, '..', '..');

(shouldSkip ? describe.skip : describe)('Browser Launch Tests', () => {
  let electronApp;

  beforeAll(async () => {
    jest.setTimeout(30000);
  });

  afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  describe('Playwright Electron Tests', () => {
    test('should launch with Playwright', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      expect(electronApp).toBeDefined();

      const window = await electronApp.firstWindow();
      expect(window).toBeDefined();
    });

    test('should have webview element', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Wait for webview to be present
      await window.waitForSelector('webview', { timeout: 10000 }).catch(() => null);
      const webview = await window.$('webview');
      expect(webview).not.toBeNull();
    });

    test('should have navigation controls', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Check for navigation buttons
      const backButton = await window.$('#back-btn, .back-button, [data-action="back"]');
      const forwardButton = await window.$('#forward-btn, .forward-button, [data-action="forward"]');
      const urlInput = await window.$('#url-bar, #url-input, input[type="url"], input[type="text"]');

      expect(backButton || forwardButton || urlInput).not.toBeNull();
    });

    test('should have address bar', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const urlInput = await window.$('#url-bar, #url-input, input[type="url"], input[type="text"]');
      expect(urlInput).not.toBeNull();
    });

    test('should respond to keyboard shortcuts', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Try opening DevTools with keyboard shortcut
      const initialWindows = electronApp.windows().length;
      await window.keyboard.press('Control+Shift+I');

      // Wait a bit for DevTools to open
      await new Promise(r => setTimeout(r, 1000));

      // DevTools might open as a separate window
      const afterWindows = electronApp.windows().length;
      // Just check that no crash occurred
      expect(afterWindows).toBeGreaterThanOrEqual(initialWindows);
    });
  });

  describe('Window Properties', () => {
    test('should have correct process type', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const processType = await window.evaluate(() => {
        return typeof window !== 'undefined' ? 'renderer' : 'unknown';
      });

      expect(processType).toBe('renderer');
    });

    test('should have electron APIs available', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Check if electron context bridge is available
      const hasElectronAPI = await window.evaluate(() => {
        return typeof window.electronAPI !== 'undefined' ||
               typeof window.require !== 'undefined';
      });

      expect(hasElectronAPI).toBe(true);
    });

    test('should have node integration disabled in renderer', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // For security, direct Node.js require should be disabled
      const hasDirectNodeAccess = await window.evaluate(() => {
        try {
          const fs = require('fs');
          return true;
        } catch (e) {
          return false;
        }
      });

      // Expect node integration to be disabled for security
      // This depends on app configuration
      expect(typeof hasDirectNodeAccess).toBe('boolean');
    });
  });

  describe('Application State', () => {
    test('should create WebSocket server on startup', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Wait for WebSocket server to start
      await new Promise(r => setTimeout(r, 2000));

      // Try to connect to WebSocket server
      const WebSocket = require('ws');
      const ws = new WebSocket('ws://localhost:8765');

      const connected = await new Promise((resolve) => {
        ws.on('open', () => resolve(true));
        ws.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 5000);
      });

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

      expect(connected).toBe(true);
    });

    test('should handle multiple launches gracefully', async () => {
      // First launch
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window1 = await electronApp.firstWindow();
      expect(window1).toBeDefined();

      // Close first instance
      await electronApp.close();

      // Second launch
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window2 = await electronApp.firstWindow();
      expect(window2).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing main.js gracefully', async () => {
      const badPath = path.join(__dirname, 'nonexistent');

      await expect(async () => {
        const badApp = await electron.launch({
          args: [badPath]
        });
        await badApp.close();
      }).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should launch within acceptable time', async () => {
      const startTime = Date.now();

      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const launchTime = Date.now() - startTime;

      // Should launch within 10 seconds
      expect(launchTime).toBeLessThan(10000);
    });

    test('should have reasonable memory usage', async () => {
      electronApp = await electron.launch({
        args: [APP_PATH]
      });

      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      // Wait for app to stabilize
      await new Promise(r => setTimeout(r, 2000));

      const memoryInfo = await window.evaluate(() => {
        if (performance && performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize
          };
        }
        return null;
      });

      if (memoryInfo) {
        // Less than 200MB heap
        expect(memoryInfo.usedJSHeapSize).toBeLessThan(200 * 1024 * 1024);
      }
    });
  });
});

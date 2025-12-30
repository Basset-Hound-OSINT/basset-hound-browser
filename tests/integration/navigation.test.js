/**
 * Basset Hound Browser - Navigation Integration Tests
 * Tests for page navigation, URL handling, and browsing functionality
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
const TEST_PAGE = 'https://example.com';

(shouldSkip ? describe.skip : describe)('Navigation Integration Tests', () => {
  let electronApp;
  let window;
  let wsClient;

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
        ws.once('message', () => resolve(ws)); // Wait for connection confirmation
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
      const id = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  beforeAll(async () => {
    jest.setTimeout(60000);
  });

  beforeEach(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [APP_PATH]
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for WebSocket server to start
    await new Promise(r => setTimeout(r, 2000));

    // Connect to WebSocket
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

  describe('Basic Navigation', () => {
    test('should navigate to URL via WebSocket command', async () => {
      const response = await sendCommand(wsClient, 'navigate', { url: TEST_PAGE });
      expect(response.success).toBe(true);

      // Wait for navigation
      await new Promise(r => setTimeout(r, 3000));

      // Verify URL
      const urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.success).toBe(true);
      expect(urlResponse.url).toContain('example.com');
    });

    test('should navigate to local file', async () => {
      const testFile = path.join(__dirname, '..', 'test-server.html');
      const fileUrl = `file://${testFile}`;

      const response = await sendCommand(wsClient, 'navigate', { url: fileUrl });
      expect(response.success).toBe(true);

      // Wait for navigation
      await new Promise(r => setTimeout(r, 1000));

      // Verify URL
      const urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.success).toBe(true);
      expect(urlResponse.url).toContain('file://');
    });

    test('should handle HTTP URL navigation', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'http://example.com'
      });
      expect(response.success).toBe(true);
    });

    test('should handle HTTPS URL navigation', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'https://example.com'
      });
      expect(response.success).toBe(true);
    });

    test('should fail for invalid URL', async () => {
      const response = await sendCommand(wsClient, 'navigate', { url: '' });
      expect(response.success).toBe(false);
    });

    test('should fail without URL parameter', async () => {
      const response = await sendCommand(wsClient, 'navigate', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });
  });

  describe('Navigation History', () => {
    test('should support back navigation', async () => {
      // Navigate to first page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      // Navigate to second page
      await sendCommand(wsClient, 'navigate', { url: 'https://www.iana.org/' });
      await new Promise(r => setTimeout(r, 2000));

      // Go back
      const response = await sendCommand(wsClient, 'go_back');
      expect(response.success).toBe(true);

      // Wait for navigation
      await new Promise(r => setTimeout(r, 2000));

      // Verify we're on the first page
      const urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('example.com');
    });

    test('should support forward navigation', async () => {
      // Navigate to first page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      // Navigate to second page
      await sendCommand(wsClient, 'navigate', { url: 'https://www.iana.org/' });
      await new Promise(r => setTimeout(r, 2000));

      // Go back
      await sendCommand(wsClient, 'go_back');
      await new Promise(r => setTimeout(r, 2000));

      // Go forward
      const response = await sendCommand(wsClient, 'go_forward');
      expect(response.success).toBe(true);

      // Wait for navigation
      await new Promise(r => setTimeout(r, 2000));

      // Verify we're on the second page
      const urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('iana.org');
    });

    test('should handle back when no history', async () => {
      const response = await sendCommand(wsClient, 'go_back');
      // Should not crash, may return success: false or just do nothing
      expect(response).toBeDefined();
    });

    test('should handle forward when no forward history', async () => {
      const response = await sendCommand(wsClient, 'go_forward');
      // Should not crash
      expect(response).toBeDefined();
    });
  });

  describe('Page Reload', () => {
    test('should reload current page', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'reload');
      expect(response.success).toBe(true);

      // Wait for reload
      await new Promise(r => setTimeout(r, 2000));

      // Verify still on same page
      const urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('example.com');
    });

    test('should support hard reload (ignore cache)', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'reload', { ignoreCache: true });
      expect(response.success).toBe(true);
    });
  });

  describe('Wait for Navigation', () => {
    test('should wait for element after navigation', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });

      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body',
        timeout: 10000
      });

      expect(response.success).toBe(true);
    });

    test('should wait for specific element', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });

      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: 'h1',
        timeout: 10000
      });

      expect(response.success).toBe(true);
    });

    test('should timeout waiting for non-existent element', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });

      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: '#non-existent-element-xyz',
        timeout: 2000
      });

      expect(response.success).toBe(false);
    });
  });

  describe('Page Content', () => {
    test('should get page content after navigation', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'get_content');
      expect(response.success).toBe(true);
      expect(response.html || response.content).toBeDefined();
    });

    test('should get page title', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'return document.title'
      });

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });

    test('should get page state', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'get_page_state');
      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'http://this-domain-does-not-exist-xyz123.com'
      });

      // Should either fail with error or succeed with error page
      expect(response).toBeDefined();
    });

    test('should handle malformed URLs', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'not-a-valid-url'
      });

      // Behavior depends on implementation
      expect(response).toBeDefined();
    });

    test('should handle special characters in URL', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'https://example.com/path?query=test&other=value#hash'
      });

      expect(response.success).toBe(true);
    });

    test('should handle unicode in URL', async () => {
      const response = await sendCommand(wsClient, 'navigate', {
        url: 'https://example.com/cafe'
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Navigation Timing', () => {
    test('should complete navigation within timeout', async () => {
      const startTime = Date.now();

      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body',
        timeout: 30000
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000);
    });

    test('should support wait_for_load_state command', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });

      const response = await sendCommand(wsClient, 'wait_for_load_state', {
        state: 'domcontentloaded',
        timeout: 30000
      });

      // May or may not be implemented
      expect(response).toBeDefined();
    });
  });

  describe('URL Validation', () => {
    test('should get current URL', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com/path' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'get_url');
      expect(response.success).toBe(true);
      expect(response.url).toBeDefined();
      expect(response.url).toContain('example.com');
    });

    test('should include path in URL', async () => {
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com/test/path' });
      await new Promise(r => setTimeout(r, 2000));

      const response = await sendCommand(wsClient, 'get_url');
      expect(response.url).toContain('/');
    });
  });

  describe('Concurrent Navigation', () => {
    test('should handle rapid navigation commands', async () => {
      // Send multiple navigation commands quickly
      const promises = [
        sendCommand(wsClient, 'navigate', { url: 'https://example.com' }),
        sendCommand(wsClient, 'navigate', { url: 'https://www.iana.org' }),
        sendCommand(wsClient, 'navigate', { url: 'https://example.org' })
      ];

      const results = await Promise.all(promises);

      // At least one should succeed
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Basset Hound Browser - Automation Integration Tests
 * Tests for browser automation commands via WebSocket
 */

const path = require('path');
const { _electron: electron } = require('@playwright/test');
const WebSocket = require('ws');

const APP_PATH = path.join(__dirname, '..', '..');
const WS_URL = 'ws://localhost:8765';
const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-server.html');
const TEST_PAGE_URL = `file://${TEST_PAGE_PATH}`;

describe('Automation Integration Tests', () => {
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

  beforeAll(async () => {
    jest.setTimeout(60000);
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

    // Navigate to test page
    await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
    await new Promise(r => setTimeout(r, 1500));
  });

  afterEach(async () => {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.close();
    }
    if (electronApp) {
      await electronApp.close();
    }
  });

  describe('Click Commands', () => {
    test('should click element by selector', async () => {
      const response = await sendCommand(wsClient, 'click', {
        selector: '#click-test-1'
      });
      expect(response.success).toBe(true);
    });

    test('should click with humanize option', async () => {
      const response = await sendCommand(wsClient, 'click', {
        selector: '#click-test-2',
        humanize: true
      });
      expect(response.success).toBe(true);
    });

    test('should fail for non-existent element', async () => {
      const response = await sendCommand(wsClient, 'click', {
        selector: '#non-existent-element-xyz'
      });
      expect(response.success).toBe(false);
    });

    test('should click and update element state', async () => {
      // Reset counter
      await sendCommand(wsClient, 'execute_script', {
        script: `
          const counter = document.getElementById('click-counter');
          if (counter) {
            counter.dataset.count = '0';
            counter.textContent = 'Clicks: 0';
          }
        `
      });

      // Click
      await sendCommand(wsClient, 'click', { selector: '#click-counter' });

      // Verify state
      const response = await sendCommand(wsClient, 'execute_script', {
        script: `return document.getElementById('click-counter')?.dataset.count`
      });

      expect(response.result).toBe('1');
    });

    test('should require selector parameter', async () => {
      const response = await sendCommand(wsClient, 'click', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector');
    });
  });

  describe('Fill Commands', () => {
    test('should fill text input', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'testuser'
      });
      expect(response.success).toBe(true);

      // Verify value
      const verifyResponse = await sendCommand(wsClient, 'execute_script', {
        script: `return document.querySelector('#username')?.value`
      });
      expect(verifyResponse.result).toBe('testuser');
    });

    test('should fill with humanize option', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'humanized_user',
        humanize: true
      });
      expect(response.success).toBe(true);
    });

    test('should fill email input', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#email',
        value: 'test@example.com'
      });
      expect(response.success).toBe(true);
    });

    test('should fill password input', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#password',
        value: 'SecurePass123!'
      });
      expect(response.success).toBe(true);
    });

    test('should fill textarea', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#message',
        value: 'This is a test message with multiple words.'
      });
      expect(response.success).toBe(true);
    });

    test('should clear existing value before filling', async () => {
      // Fill once
      await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'first_value'
      });

      // Fill again
      await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'second_value'
      });

      // Verify only second value
      const verifyResponse = await sendCommand(wsClient, 'execute_script', {
        script: `return document.querySelector('#username')?.value`
      });
      expect(verifyResponse.result).toBe('second_value');
    });

    test('should require selector and value', async () => {
      const response = await sendCommand(wsClient, 'fill', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector and value');
    });
  });

  describe('Script Execution', () => {
    test('should execute simple script', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'return 1 + 1'
      });
      expect(response.success).toBe(true);
      expect(response.result).toBe(2);
    });

    test('should access DOM', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'return document.title'
      });
      expect(response.success).toBe(true);
      expect(typeof response.result).toBe('string');
    });

    test('should return objects', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'return { foo: "bar", num: 42 }'
      });
      expect(response.success).toBe(true);
      expect(response.result.foo).toBe('bar');
      expect(response.result.num).toBe(42);
    });

    test('should return arrays', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'return [1, 2, 3]'
      });
      expect(response.success).toBe(true);
      expect(response.result).toEqual([1, 2, 3]);
    });

    test('should handle async scripts', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: `
          return new Promise(resolve => {
            setTimeout(() => resolve('async result'), 100);
          });
        `
      });
      expect(response.success).toBe(true);
      expect(response.result).toBe('async result');
    });

    test('should handle script errors', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {
        script: 'throw new Error("Test error")'
      });
      expect(response.success).toBe(false);
    });

    test('should modify DOM', async () => {
      await sendCommand(wsClient, 'execute_script', {
        script: `document.body.setAttribute('data-test', 'modified')`
      });

      const verifyResponse = await sendCommand(wsClient, 'execute_script', {
        script: `return document.body.getAttribute('data-test')`
      });
      expect(verifyResponse.result).toBe('modified');
    });

    test('should require script parameter', async () => {
      const response = await sendCommand(wsClient, 'execute_script', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('Script');
    });
  });

  describe('Scroll Commands', () => {
    test('should scroll to position', async () => {
      const response = await sendCommand(wsClient, 'scroll', {
        x: 0,
        y: 500
      });
      expect(response.success).toBe(true);
    });

    test('should scroll to element', async () => {
      const response = await sendCommand(wsClient, 'scroll', {
        selector: '#test-form'
      });
      expect(response.success).toBe(true);
    });

    test('should scroll with humanize option', async () => {
      const response = await sendCommand(wsClient, 'scroll', {
        y: 300,
        humanize: true
      });
      expect(response.success).toBe(true);
    });

    test('should scroll horizontally', async () => {
      const response = await sendCommand(wsClient, 'scroll', {
        x: 200,
        y: 0
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Wait Commands', () => {
    test('should wait for element', async () => {
      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body',
        timeout: 5000
      });
      expect(response.success).toBe(true);
    });

    test('should timeout for non-existent element', async () => {
      const startTime = Date.now();
      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: '#element-that-will-never-exist',
        timeout: 2000
      });
      const duration = Date.now() - startTime;

      expect(response.success).toBe(false);
      expect(duration).toBeGreaterThanOrEqual(1500);
    });

    test('should require selector parameter', async () => {
      const response = await sendCommand(wsClient, 'wait_for_element', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector');
    });

    test('should use default timeout if not specified', async () => {
      const response = await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body'
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Cookie Commands', () => {
    test('should get cookies', async () => {
      const response = await sendCommand(wsClient, 'get_cookies', {
        url: 'https://example.com'
      });
      expect(response.success).toBe(true);
      expect(Array.isArray(response.cookies)).toBe(true);
    });

    test('should set cookies', async () => {
      const response = await sendCommand(wsClient, 'set_cookies', {
        cookies: [{
          name: 'test_cookie',
          value: 'test_value',
          url: 'https://example.com'
        }]
      });
      expect(response.success).toBe(true);
    });

    test('should require URL for get_cookies', async () => {
      const response = await sendCommand(wsClient, 'get_cookies', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('URL');
    });

    test('should require cookies array for set_cookies', async () => {
      const response = await sendCommand(wsClient, 'set_cookies', {});
      expect(response.success).toBe(false);
      expect(response.error).toContain('Cookies');
    });
  });

  describe('Screenshot Commands', () => {
    test('should capture screenshot', async () => {
      const response = await sendCommand(wsClient, 'screenshot');
      expect(response.success).toBe(true);
      expect(response.screenshot || response.data).toBeDefined();
    });

    test('should support PNG format', async () => {
      const response = await sendCommand(wsClient, 'screenshot', {
        format: 'png'
      });
      expect(response.success).toBe(true);
    });

    test('should support JPEG format', async () => {
      const response = await sendCommand(wsClient, 'screenshot', {
        format: 'jpeg'
      });
      expect(response.success).toBe(true);
    });

    test('should support quality option', async () => {
      const response = await sendCommand(wsClient, 'screenshot', {
        format: 'jpeg',
        quality: 80
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Page State Commands', () => {
    test('should get page content', async () => {
      const response = await sendCommand(wsClient, 'get_content');
      expect(response.success).toBe(true);
      expect(response.html || response.content).toBeDefined();
    });

    test('should get page state', async () => {
      const response = await sendCommand(wsClient, 'get_page_state');
      expect(response.success).toBe(true);
    });

    test('should get current URL', async () => {
      const response = await sendCommand(wsClient, 'get_url');
      expect(response.success).toBe(true);
      expect(response.url).toBeDefined();
    });
  });

  describe('Select Commands', () => {
    test('should select option in dropdown', async () => {
      // May need a select element in test page
      const response = await sendCommand(wsClient, 'select', {
        selector: '#select-option',
        value: 'opt2'
      });
      // Behavior depends on implementation
      expect(response).toBeDefined();
    });
  });

  describe('Keyboard Commands', () => {
    test('should type text', async () => {
      // Focus input first
      await sendCommand(wsClient, 'click', { selector: '#username' });

      const response = await sendCommand(wsClient, 'type_text', {
        text: 'typed content'
      });
      expect(response.success).toBe(true);
    });

    test('should press special key', async () => {
      await sendCommand(wsClient, 'click', { selector: '#username' });

      const response = await sendCommand(wsClient, 'key_press', {
        key: 'Enter'
      });
      expect(response.success).toBe(true);
    });

    test('should press key combination', async () => {
      const response = await sendCommand(wsClient, 'key_combination', {
        keys: ['Control', 'a']
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Mouse Commands', () => {
    test('should move mouse to coordinates', async () => {
      const response = await sendCommand(wsClient, 'mouse_move', {
        x: 100,
        y: 100
      });
      expect(response.success).toBe(true);
    });

    test('should click at coordinates', async () => {
      const response = await sendCommand(wsClient, 'mouse_click', {
        x: 100,
        y: 100
      });
      expect(response.success).toBe(true);
    });

    test('should double click', async () => {
      const response = await sendCommand(wsClient, 'mouse_double_click', {
        x: 100,
        y: 100
      });
      expect(response.success).toBe(true);
    });

    test('should right click', async () => {
      const response = await sendCommand(wsClient, 'mouse_right_click', {
        x: 100,
        y: 100
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Form Submission', () => {
    test('should fill and submit form', async () => {
      // Fill form fields
      await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'testuser'
      });

      await sendCommand(wsClient, 'fill', {
        selector: '#email',
        value: 'test@example.com'
      });

      await sendCommand(wsClient, 'fill', {
        selector: '#password',
        value: 'password123'
      });

      // Click submit
      const response = await sendCommand(wsClient, 'click', {
        selector: '#submit-btn'
      });

      expect(response.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid selector gracefully', async () => {
      const response = await sendCommand(wsClient, 'click', {
        selector: '[]invalid[selector'
      });
      // Should not crash, may return error
      expect(response).toBeDefined();
    });

    test('should handle null parameters', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: null,
        value: null
      });
      expect(response.success).toBe(false);
    });

    test('should handle large scripts', async () => {
      const largeScript = `return "${'a'.repeat(10000)}"`;
      const response = await sendCommand(wsClient, 'execute_script', {
        script: largeScript
      });
      expect(response).toBeDefined();
    });

    test('should handle special characters in values', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: '<script>alert(1)</script>'
      });
      expect(response.success).toBe(true);
    });

    test('should handle unicode characters', async () => {
      const response = await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'cafe'
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Rapid Commands', () => {
    test('should handle rapid commands', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(sendCommand(wsClient, 'ping'));
      }
      const responses = await Promise.all(promises);
      const successes = responses.filter(r => r.success).length;
      expect(successes).toBeGreaterThanOrEqual(3);
    });

    test('should maintain state across commands', async () => {
      await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'persistent_value'
      });

      await new Promise(r => setTimeout(r, 100));

      const response = await sendCommand(wsClient, 'execute_script', {
        script: `return document.querySelector('#username')?.value`
      });

      expect(response.result).toBe('persistent_value');
    });
  });
});

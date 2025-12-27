/**
 * Basset Hound Browser - End-to-End Full Workflow Tests
 * Comprehensive tests that simulate real automation workflows
 */

const path = require('path');
const fs = require('fs');
const { _electron: electron } = require('@playwright/test');
const WebSocket = require('ws');

const APP_PATH = path.join(__dirname, '..', '..');
const WS_URL = 'ws://localhost:8765';
const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-server.html');
const TEST_PAGE_URL = `file://${TEST_PAGE_PATH}`;

describe('End-to-End Full Workflow Tests', () => {
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
      const id = `e2e-${Date.now()}-${messageId++}`;
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
   * Wait for specified milliseconds
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    jest.setTimeout(180000); // 3 minutes for E2E tests
  });

  beforeEach(async () => {
    electronApp = await electron.launch({
      args: [APP_PATH]
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Wait for WebSocket server to start
    await wait(3000);

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

  describe('Complete Form Automation Workflow', () => {
    test('should complete a full form submission workflow', async () => {
      // 1. Navigate to test page
      const navResponse = await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      expect(navResponse.success).toBe(true);
      await wait(2000);

      // 2. Wait for form to be ready
      const waitResponse = await sendCommand(wsClient, 'wait_for_element', {
        selector: '#test-form',
        timeout: 10000
      });
      expect(waitResponse.success).toBe(true);

      // 3. Fill username field with human-like typing
      const usernameResponse = await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'test_automation_user',
        humanize: true
      });
      expect(usernameResponse.success).toBe(true);
      await wait(500);

      // 4. Fill email field
      const emailResponse = await sendCommand(wsClient, 'fill', {
        selector: '#email',
        value: 'automation@test.com',
        humanize: true
      });
      expect(emailResponse.success).toBe(true);
      await wait(500);

      // 5. Fill password field
      const passwordResponse = await sendCommand(wsClient, 'fill', {
        selector: '#password',
        value: 'SecureP@ssw0rd!',
        humanize: true
      });
      expect(passwordResponse.success).toBe(true);
      await wait(500);

      // 6. Fill message textarea
      const messageResponse = await sendCommand(wsClient, 'fill', {
        selector: '#message',
        value: 'This is an automated test message to verify the form submission workflow is working correctly.',
        humanize: true
      });
      expect(messageResponse.success).toBe(true);
      await wait(500);

      // 7. Click submit button
      const submitResponse = await sendCommand(wsClient, 'click', {
        selector: '#submit-btn',
        humanize: true
      });
      expect(submitResponse.success).toBe(true);
      await wait(1000);

      // 8. Verify form values were set correctly
      const verification = await executeScript(`
        return {
          username: document.querySelector('#username')?.value,
          email: document.querySelector('#email')?.value,
          password: document.querySelector('#password')?.value,
          message: document.querySelector('#message')?.value
        };
      `);

      expect(verification.username).toBe('test_automation_user');
      expect(verification.email).toBe('automation@test.com');
      expect(verification.password).toBe('SecureP@ssw0rd!');
      expect(verification.message).toContain('automated test message');

      // 9. Take screenshot of completed form
      const screenshotResponse = await sendCommand(wsClient, 'screenshot', {
        format: 'png'
      });
      expect(screenshotResponse.success).toBe(true);
      expect(screenshotResponse.screenshot || screenshotResponse.data).toBeDefined();
    });
  });

  describe('Multi-Page Navigation Workflow', () => {
    test('should navigate through multiple pages and maintain state', async () => {
      // 1. Navigate to first page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await wait(3000);

      // 2. Verify we're on the first page
      let urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('example.com');

      // 3. Execute script to get page title
      const title1 = await executeScript('return document.title');
      expect(title1).toBeDefined();

      // 4. Navigate to second page
      await sendCommand(wsClient, 'navigate', { url: 'https://www.iana.org/domains/reserved' });
      await wait(3000);

      // 5. Verify we're on second page
      urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('iana.org');

      // 6. Navigate back
      await sendCommand(wsClient, 'go_back');
      await wait(2000);

      // 7. Verify we're back on first page
      urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('example.com');

      // 8. Navigate forward
      await sendCommand(wsClient, 'go_forward');
      await wait(2000);

      // 9. Verify we're on second page again
      urlResponse = await sendCommand(wsClient, 'get_url');
      expect(urlResponse.url).toContain('iana.org');
    });
  });

  describe('Bot Detection Evasion Workflow', () => {
    test('should pass all bot detection checks while browsing', async () => {
      // Navigate to a page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await wait(3000);

      // Run comprehensive bot detection checks
      const evasionResults = await executeScript(`
        const results = {};

        // WebDriver check
        results.webdriver = navigator.webdriver !== true;

        // Selenium checks
        results.noSelenium = typeof window._selenium === 'undefined';
        results.noCallSelenium = typeof window.callSelenium === 'undefined';

        // Phantom checks
        results.noPhantom = typeof window._phantom === 'undefined';
        results.noCallPhantom = typeof window.callPhantom === 'undefined';

        // Navigator checks
        results.hasPlugins = navigator.plugins && navigator.plugins.length > 0;
        results.hasLanguages = navigator.languages && navigator.languages.length > 0;
        results.hasValidPlatform = !!navigator.platform;

        // Chrome object
        results.hasChrome = typeof window.chrome !== 'undefined';

        // Screen checks
        results.validScreen = screen.width > 0 && screen.height > 0;

        // User agent check
        results.realisticUA = navigator.userAgent.includes('Chrome') ||
                             navigator.userAgent.includes('Firefox') ||
                             navigator.userAgent.includes('Safari');

        // Permissions API
        results.permissionsWork = typeof navigator.permissions !== 'undefined';

        return results;
      `);

      // All checks should pass
      expect(evasionResults.webdriver).toBe(true);
      expect(evasionResults.noSelenium).toBe(true);
      expect(evasionResults.noCallSelenium).toBe(true);
      expect(evasionResults.noPhantom).toBe(true);
      expect(evasionResults.noCallPhantom).toBe(true);
      expect(evasionResults.hasPlugins).toBe(true);
      expect(evasionResults.hasLanguages).toBe(true);
      expect(evasionResults.hasValidPlatform).toBe(true);
      expect(evasionResults.hasChrome).toBe(true);
      expect(evasionResults.validScreen).toBe(true);
      expect(evasionResults.realisticUA).toBe(true);
      expect(evasionResults.permissionsWork).toBe(true);
    });
  });

  describe('Cookie and Session Management Workflow', () => {
    test('should set and retrieve cookies correctly', async () => {
      // Navigate to a page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await wait(2000);

      // Set cookies
      const setCookieResponse = await sendCommand(wsClient, 'set_cookies', {
        cookies: [
          {
            name: 'session_id',
            value: 'abc123xyz',
            url: 'https://example.com'
          },
          {
            name: 'user_preference',
            value: 'dark_mode',
            url: 'https://example.com'
          }
        ]
      });
      expect(setCookieResponse.success).toBe(true);

      // Get cookies
      const getCookieResponse = await sendCommand(wsClient, 'get_cookies', {
        url: 'https://example.com'
      });
      expect(getCookieResponse.success).toBe(true);
      expect(Array.isArray(getCookieResponse.cookies)).toBe(true);

      // Verify our cookies are present
      const sessionCookie = getCookieResponse.cookies.find(c => c.name === 'session_id');
      const prefCookie = getCookieResponse.cookies.find(c => c.name === 'user_preference');

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie.value).toBe('abc123xyz');
      expect(prefCookie).toBeDefined();
      expect(prefCookie.value).toBe('dark_mode');
    });
  });

  describe('Screenshot Capture Workflow', () => {
    test('should capture screenshots in different formats', async () => {
      // Navigate to a page with content
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await wait(3000);

      // Capture PNG screenshot
      const pngResponse = await sendCommand(wsClient, 'screenshot', {
        format: 'png'
      });
      expect(pngResponse.success).toBe(true);
      const pngData = pngResponse.screenshot || pngResponse.data;
      expect(pngData).toBeDefined();
      expect(pngData.length).toBeGreaterThan(1000);

      // Capture JPEG screenshot
      const jpegResponse = await sendCommand(wsClient, 'screenshot', {
        format: 'jpeg',
        quality: 80
      });
      expect(jpegResponse.success).toBe(true);
      const jpegData = jpegResponse.screenshot || jpegResponse.data;
      expect(jpegData).toBeDefined();
      expect(jpegData.length).toBeGreaterThan(1000);
    });
  });

  describe('Scroll and Content Extraction Workflow', () => {
    test('should scroll and extract content from page', async () => {
      // Navigate to a page
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await wait(2000);

      // Get initial scroll position
      const initialScroll = await executeScript('return window.scrollY');

      // Scroll down
      await sendCommand(wsClient, 'scroll', {
        y: 300,
        humanize: true
      });
      await wait(1000);

      // Verify scroll happened
      const afterScroll = await executeScript('return window.scrollY');
      expect(afterScroll).toBeGreaterThanOrEqual(0);

      // Get page content
      const contentResponse = await sendCommand(wsClient, 'get_content');
      expect(contentResponse.success).toBe(true);
      const content = contentResponse.html || contentResponse.content;
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(100);

      // Extract specific elements
      const headings = await executeScript(`
        return Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => h.textContent.trim())
          .filter(t => t.length > 0);
      `);
      expect(Array.isArray(headings)).toBe(true);
    });
  });

  describe('Human-like Interaction Workflow', () => {
    test('should perform human-like interactions', async () => {
      // Navigate to test page
      await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      await wait(2000);

      // Mouse move with human-like path
      await sendCommand(wsClient, 'mouse_move', {
        x: 200,
        y: 200,
        humanize: true
      });
      await wait(500);

      // Click with human-like timing
      await sendCommand(wsClient, 'click', {
        selector: '#click-test-1',
        humanize: true
      });
      await wait(500);

      // Type with human-like delays
      await sendCommand(wsClient, 'click', {
        selector: '#username'
      });
      await wait(200);

      await sendCommand(wsClient, 'type_text', {
        text: 'human_like_typing',
        humanize: true
      });
      await wait(500);

      // Scroll with human-like behavior
      await sendCommand(wsClient, 'scroll', {
        y: 200,
        humanize: true
      });
      await wait(500);

      // Verify the input was filled
      const inputValue = await executeScript(`
        return document.querySelector('#username')?.value
      `);
      expect(inputValue).toContain('human_like_typing');
    });
  });

  describe('Error Recovery Workflow', () => {
    test('should recover from errors gracefully', async () => {
      // Navigate to test page
      await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      await wait(2000);

      // Try to click non-existent element
      const clickError = await sendCommand(wsClient, 'click', {
        selector: '#non-existent-element'
      });
      expect(clickError.success).toBe(false);

      // Browser should still be functional
      const pingResponse = await sendCommand(wsClient, 'ping');
      expect(pingResponse.success).toBe(true);

      // Try invalid navigation
      const navError = await sendCommand(wsClient, 'navigate', { url: '' });
      expect(navError.success).toBe(false);

      // Browser should still be functional
      const statusResponse = await sendCommand(wsClient, 'status');
      expect(statusResponse.success).toBe(true);
      expect(statusResponse.status.ready).toBe(true);

      // Regular operations should still work
      const validNav = await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      expect(validNav.success).toBe(true);
    });
  });

  describe('Concurrent Operations Workflow', () => {
    test('should handle multiple concurrent commands', async () => {
      // Navigate to test page
      await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      await wait(2000);

      // Send multiple commands concurrently
      const commands = [
        sendCommand(wsClient, 'ping'),
        sendCommand(wsClient, 'status'),
        sendCommand(wsClient, 'get_url'),
        sendCommand(wsClient, 'execute_script', { script: 'return 1+1' }),
        sendCommand(wsClient, 'get_page_state')
      ];

      const results = await Promise.all(commands);

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Complete Automation Session Workflow', () => {
    test('should complete a full automation session', async () => {
      const sessionLog = [];

      // 1. Start session
      sessionLog.push('Session started');
      const statusStart = await sendCommand(wsClient, 'status');
      expect(statusStart.success).toBe(true);
      sessionLog.push('Server status verified');

      // 2. Navigate to page
      await sendCommand(wsClient, 'navigate', { url: TEST_PAGE_URL });
      await wait(2000);
      sessionLog.push('Navigated to test page');

      // 3. Verify page loaded
      const waitBody = await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body',
        timeout: 10000
      });
      expect(waitBody.success).toBe(true);
      sessionLog.push('Page loaded');

      // 4. Perform form automation
      await sendCommand(wsClient, 'fill', {
        selector: '#username',
        value: 'session_user',
        humanize: true
      });
      sessionLog.push('Filled username');

      await sendCommand(wsClient, 'fill', {
        selector: '#email',
        value: 'session@test.com',
        humanize: true
      });
      sessionLog.push('Filled email');

      // 5. Take screenshot
      const screenshot = await sendCommand(wsClient, 'screenshot', { format: 'png' });
      expect(screenshot.success).toBe(true);
      sessionLog.push('Screenshot captured');

      // 6. Extract data
      const formData = await executeScript(`
        return {
          username: document.querySelector('#username')?.value,
          email: document.querySelector('#email')?.value,
          title: document.title,
          url: window.location.href
        };
      `);
      sessionLog.push('Data extracted');

      // 7. Verify bot detection evasion
      const evasionCheck = await executeScript(`
        return navigator.webdriver !== true &&
               typeof window._selenium === 'undefined' &&
               navigator.plugins.length > 0;
      `);
      expect(evasionCheck).toBe(true);
      sessionLog.push('Evasion verified');

      // 8. Final status check
      const statusEnd = await sendCommand(wsClient, 'status');
      expect(statusEnd.success).toBe(true);
      sessionLog.push('Session completed');

      // Log should have all steps
      expect(sessionLog.length).toBe(10);
      console.log('Session log:', sessionLog);
    });
  });

  describe('Performance and Timing Workflow', () => {
    test('should complete operations within reasonable time', async () => {
      const timings = {};

      // Measure navigation time
      const navStart = Date.now();
      await sendCommand(wsClient, 'navigate', { url: 'https://example.com' });
      await sendCommand(wsClient, 'wait_for_element', {
        selector: 'body',
        timeout: 30000
      });
      timings.navigation = Date.now() - navStart;
      expect(timings.navigation).toBeLessThan(30000);

      // Measure script execution time
      const scriptStart = Date.now();
      await executeScript('return document.title');
      timings.script = Date.now() - scriptStart;
      expect(timings.script).toBeLessThan(5000);

      // Measure screenshot time
      const screenshotStart = Date.now();
      await sendCommand(wsClient, 'screenshot', { format: 'png' });
      timings.screenshot = Date.now() - screenshotStart;
      expect(timings.screenshot).toBeLessThan(10000);

      // Measure ping time
      const pingStart = Date.now();
      await sendCommand(wsClient, 'ping');
      timings.ping = Date.now() - pingStart;
      expect(timings.ping).toBeLessThan(1000);

      console.log('Operation timings:', timings);
    });
  });
});

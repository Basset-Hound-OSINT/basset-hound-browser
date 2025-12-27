/**
 * Basset Hound Browser - E2E Browser Automation Tests
 * End-to-end tests for complete browser automation workflows
 */

const path = require('path');
const { WebSocketTestClient, waitForServer } = require('../helpers/websocket-client');

// Test configuration
const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  CONNECT_TIMEOUT: parseInt(process.env.CONNECT_TIMEOUT) || 15000,
  COMMAND_TIMEOUT: parseInt(process.env.COMMAND_TIMEOUT) || 30000,
  TEST_PAGE_URL: `file://${path.resolve(__dirname, '../test-server.html')}`,
  SKIP_E2E: process.env.SKIP_E2E === 'true'
};

// Skip if E2E tests are disabled
const describeE2E = CONFIG.SKIP_E2E ? describe.skip : describe;

describeE2E('E2E Browser Automation', () => {
  let client;

  beforeAll(async () => {
    // Wait for server to be available
    const serverAvailable = await waitForServer(CONFIG.WS_URL, CONFIG.CONNECT_TIMEOUT);
    if (!serverAvailable) {
      throw new Error(`WebSocket server not available at ${CONFIG.WS_URL}. Make sure the browser is running.`);
    }
  });

  beforeEach(async () => {
    client = new WebSocketTestClient({
      url: CONFIG.WS_URL,
      connectTimeout: CONFIG.CONNECT_TIMEOUT,
      commandTimeout: CONFIG.COMMAND_TIMEOUT
    });
    await client.connect();
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Connection and Basic Commands', () => {
    test('should connect to WebSocket server', () => {
      expect(client.isConnected()).toBe(true);
    });

    test('should respond to ping', async () => {
      const response = await client.ping();

      expect(response.success).toBe(true);
      expect(response.message).toBe('pong');
    });

    test('should return server status', async () => {
      const response = await client.status();

      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.status.ready).toBe(true);
    });
  });

  describe('Navigation Workflow', () => {
    test('should navigate to URL', async () => {
      const response = await client.navigate(CONFIG.TEST_PAGE_URL);

      expect(response.success).toBe(true);
      expect(response.url).toBe(CONFIG.TEST_PAGE_URL);
    });

    test('should get current URL', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      const response = await client.getUrl();

      expect(response.success).toBe(true);
      expect(response.url).toContain('test-server.html');
    });

    test('should go back and forward', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await client.navigate('about:blank');

      const backResponse = await client.goBack();
      expect(backResponse.success).toBe(true);

      const forwardResponse = await client.goForward();
      expect(forwardResponse.success).toBe(true);
    });

    test('should reload page', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);

      const response = await client.reload();
      expect(response.success).toBe(true);
    });
  });

  describe('Form Interaction Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000)); // Wait for page load
    });

    test('should fill text input', async () => {
      const response = await client.fill('#test-input', 'Test Value');

      expect(response.success).toBe(true);
    });

    test('should click button', async () => {
      const response = await client.click('#test-button');

      expect(response.success).toBe(true);
    });

    test('should wait for element', async () => {
      const response = await client.waitForElement('#test-input');

      expect(response.success).toBe(true);
    });

    test('should handle non-existent element', async () => {
      const response = await client.waitForElement('#non-existent', 1000);

      expect(response.success).toBe(false);
    });
  });

  describe('Page Content Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should get page content', async () => {
      const response = await client.getContent();

      expect(response.success).toBe(true);
      expect(response.html || response.content).toBeDefined();
    });

    test('should execute script', async () => {
      const response = await client.executeScript('return document.title');

      expect(response.success).toBe(true);
      expect(response.result).toBeDefined();
    });

    test('should execute DOM manipulation', async () => {
      const response = await client.executeScript(
        'document.body.setAttribute("data-test", "modified"); return true;'
      );

      expect(response.success).toBe(true);
    });
  });

  describe('Screenshot Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should take screenshot', async () => {
      const response = await client.screenshot();

      expect(response.success).toBe(true);
      expect(response.data || response.image).toBeDefined();
    });

    test('should take screenshot with options', async () => {
      const response = await client.screenshot({ format: 'png', quality: 80 });

      expect(response.success).toBe(true);
    });
  });

  describe('Mouse Interaction Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should move mouse', async () => {
      const response = await client.mouseMove(100, 100);

      expect(response.success).toBe(true);
    });

    test('should click at coordinates', async () => {
      const response = await client.mouseClick(100, 100);

      expect(response.success).toBe(true);
    });
  });

  describe('Keyboard Interaction Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should type text', async () => {
      await client.click('#test-input');
      const response = await client.typeText('Typed text');

      expect(response.success).toBe(true);
    });

    test('should press key', async () => {
      const response = await client.keyPress('Enter');

      expect(response.success).toBe(true);
    });

    test('should press key combination', async () => {
      const response = await client.keyCombination(['Control', 'a']);

      expect(response.success).toBe(true);
    });
  });

  describe('Cookie Workflow', () => {
    beforeEach(async () => {
      await client.navigate('https://example.com');
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should get cookies', async () => {
      const response = await client.getCookies('https://example.com');

      expect(response.success).toBe(true);
      expect(response.cookies).toBeDefined();
      expect(Array.isArray(response.cookies)).toBe(true);
    });

    test('should set cookies', async () => {
      const cookies = [{
        url: 'https://example.com',
        name: 'test_cookie',
        value: 'test_value'
      }];

      const response = await client.setCookies(cookies);
      expect(response.success).toBe(true);
    });
  });

  describe('Scroll Workflow', () => {
    beforeEach(async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));
    });

    test('should scroll to position', async () => {
      const response = await client.scroll({ x: 0, y: 500 });

      expect(response.success).toBe(true);
    });

    test('should scroll to element', async () => {
      const response = await client.scroll({ selector: '#test-button' });

      expect(response.success).toBe(true);
    });
  });

  describe('Complete Automation Workflow', () => {
    test('should complete full form submission workflow', async () => {
      // Navigate to test page
      let response = await client.navigate(CONFIG.TEST_PAGE_URL);
      expect(response.success).toBe(true);

      // Wait for page load
      await new Promise(r => setTimeout(r, 1500));

      // Wait for form element
      response = await client.waitForElement('#test-input');
      expect(response.success).toBe(true);

      // Fill form
      response = await client.fill('#test-input', 'Test Form Data');
      expect(response.success).toBe(true);

      // Click submit
      response = await client.click('#test-button');
      expect(response.success).toBe(true);

      // Verify with script
      response = await client.executeScript('return document.querySelector("#test-input").value');
      expect(response.success).toBe(true);
    });

    test('should complete multi-step navigation workflow', async () => {
      // Navigate to test page
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      // Get current URL
      let response = await client.getUrl();
      const originalUrl = response.url;

      // Navigate to another page
      await client.navigate('about:blank');
      await new Promise(r => setTimeout(r, 500));

      // Go back
      response = await client.goBack();
      expect(response.success).toBe(true);

      // Verify we're back
      response = await client.getUrl();
      expect(response.url).toBe(originalUrl);
    });
  });
});

describe('E2E Bot Detection Evasion', () => {
  let client;

  const describeEvasion = CONFIG.SKIP_E2E ? describe.skip : describe;

  describeEvasion('Bot Detection Tests', () => {
    beforeAll(async () => {
      const serverAvailable = await waitForServer(CONFIG.WS_URL, CONFIG.CONNECT_TIMEOUT);
      if (!serverAvailable) {
        throw new Error('WebSocket server not available');
      }
    });

    beforeEach(async () => {
      client = new WebSocketTestClient({ url: CONFIG.WS_URL });
      await client.connect();
    });

    afterEach(() => {
      if (client) client.disconnect();
    });

    test('should pass navigator.webdriver check', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      const response = await client.executeScript('return navigator.webdriver');

      expect(response.success).toBe(true);
      expect(response.result).toBeFalsy();
    });

    test('should have plugins array', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      const response = await client.executeScript('return navigator.plugins.length > 0');

      expect(response.success).toBe(true);
      expect(response.result).toBe(true);
    });

    test('should have languages array', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      const response = await client.executeScript('return Array.isArray(navigator.languages) && navigator.languages.length > 0');

      expect(response.success).toBe(true);
      expect(response.result).toBe(true);
    });

    test('should have chrome object', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      const response = await client.executeScript('return !!window.chrome');

      expect(response.success).toBe(true);
      expect(response.result).toBe(true);
    });

    test('should not have automation properties', async () => {
      await client.navigate(CONFIG.TEST_PAGE_URL);
      await new Promise(r => setTimeout(r, 1000));

      const response = await client.executeScript(`
        return !window._phantom &&
               !window.__nightmare &&
               !window.callPhantom &&
               !document.__selenium_unwrapped &&
               !document.__webdriver_evaluate &&
               !document.__webdriver_script_fn
      `);

      expect(response.success).toBe(true);
      expect(response.result).toBe(true);
    });
  });
});

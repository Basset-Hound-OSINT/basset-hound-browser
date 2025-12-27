/**
 * Basset Hound Browser - Electron Test Helpers
 * Utilities for testing Electron applications
 */

const path = require('path');
const { _electron: electron } = require('@playwright/test');

const APP_PATH = path.join(__dirname, '..', '..');

/**
 * Launch the Electron application
 * @param {Object} options - Launch options
 * @returns {Promise<Object>} - { app, window }
 */
async function launchApp(options = {}) {
  const {
    timeout = 30000,
    args = [],
    env = {}
  } = options;

  const electronApp = await electron.launch({
    args: [APP_PATH, ...args],
    timeout,
    env: {
      ...process.env,
      ...env
    }
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app: electronApp, window };
}

/**
 * Close the Electron application
 * @param {Object} app - Electron application instance
 */
async function closeApp(app) {
  if (app) {
    await app.close();
  }
}

/**
 * Wait for WebSocket server to be ready
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} - Whether server is ready
 */
async function waitForWebSocketServer(timeout = 10000) {
  const WebSocket = require('ws');
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const ws = new WebSocket('ws://localhost:8765');
      const connected = await new Promise((resolve) => {
        ws.on('open', () => {
          ws.close();
          resolve(true);
        });
        ws.on('error', () => resolve(false));
        setTimeout(() => resolve(false), 2000);
      });
      if (connected) return true;
    } catch {
      // Ignore and retry
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return false;
}

/**
 * Take screenshot of the application window
 * @param {Object} window - Playwright window
 * @param {string} name - Screenshot name
 * @returns {Promise<Buffer>} - Screenshot buffer
 */
async function takeScreenshot(window, name = 'screenshot') {
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  // Ensure screenshots directory exists
  const fs = require('fs');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const screenshotPath = path.join(screenshotsDir, `${name}-${Date.now()}.png`);
  const buffer = await window.screenshot({ path: screenshotPath });

  return buffer;
}

/**
 * Get the webview element from the window
 * @param {Object} window - Playwright window
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} - Webview element handle
 */
async function getWebview(window, timeout = 10000) {
  await window.waitForSelector('webview', { timeout });
  return await window.$('webview');
}

/**
 * Execute JavaScript in the main window context
 * @param {Object} window - Playwright window
 * @param {Function|string} fn - Function or script to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} - Result of execution
 */
async function executeInWindow(window, fn, ...args) {
  return await window.evaluate(fn, ...args);
}

/**
 * Wait for an element to appear in the window
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @param {Object} options - Wait options
 * @returns {Promise<Object>} - Element handle
 */
async function waitForElement(window, selector, options = {}) {
  const { timeout = 10000, state = 'visible' } = options;
  await window.waitForSelector(selector, { timeout, state });
  return await window.$(selector);
}

/**
 * Type text into an input element
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 */
async function typeInto(window, selector, text, options = {}) {
  const { delay = 50 } = options;
  const element = await window.$(selector);
  if (element) {
    await element.click();
    await element.type(text, { delay });
  }
}

/**
 * Click an element
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @param {Object} options - Click options
 */
async function clickElement(window, selector, options = {}) {
  const element = await window.$(selector);
  if (element) {
    await element.click(options);
  }
}

/**
 * Get all console messages from the window
 * @param {Object} window - Playwright window
 * @returns {Promise<Array>} - Array of console messages
 */
function getConsoleLogs(window) {
  const logs = [];

  window.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  return logs;
}

/**
 * Wait for navigation to complete
 * @param {Object} window - Playwright window
 * @param {string} url - URL to wait for (optional)
 * @param {Object} options - Wait options
 */
async function waitForNavigation(window, url = null, options = {}) {
  const { timeout = 30000 } = options;

  if (url) {
    await window.waitForURL(url, { timeout });
  } else {
    await window.waitForLoadState('load', { timeout });
  }
}

/**
 * Check if element exists
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>} - Whether element exists
 */
async function elementExists(window, selector) {
  const element = await window.$(selector);
  return element !== null;
}

/**
 * Get element text content
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @returns {Promise<string|null>} - Text content
 */
async function getElementText(window, selector) {
  const element = await window.$(selector);
  if (element) {
    return await element.textContent();
  }
  return null;
}

/**
 * Get element attribute
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @returns {Promise<string|null>} - Attribute value
 */
async function getElementAttribute(window, selector, attribute) {
  const element = await window.$(selector);
  if (element) {
    return await element.getAttribute(attribute);
  }
  return null;
}

/**
 * Get input value
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @returns {Promise<string|null>} - Input value
 */
async function getInputValue(window, selector) {
  return await window.evaluate((sel) => {
    const element = document.querySelector(sel);
    return element ? element.value : null;
  }, selector);
}

/**
 * Set input value
 * @param {Object} window - Playwright window
 * @param {string} selector - CSS selector
 * @param {string} value - Value to set
 */
async function setInputValue(window, selector, value) {
  await window.evaluate((sel, val) => {
    const element = document.querySelector(sel);
    if (element) {
      element.value = val;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, value);
}

/**
 * Simulate keyboard shortcut
 * @param {Object} window - Playwright window
 * @param {string} shortcut - Keyboard shortcut (e.g., 'Control+Shift+I')
 */
async function pressShortcut(window, shortcut) {
  await window.keyboard.press(shortcut);
}

/**
 * Get window bounds
 * @param {Object} app - Electron application
 * @returns {Promise<Object>} - { x, y, width, height }
 */
async function getWindowBounds(app) {
  const window = await app.firstWindow();
  const bounds = await window.evaluate(() => ({
    x: window.screenX,
    y: window.screenY,
    width: window.innerWidth,
    height: window.innerHeight
  }));
  return bounds;
}

/**
 * Check if app is running
 * @param {Object} app - Electron application
 * @returns {Promise<boolean>} - Whether app is running
 */
async function isAppRunning(app) {
  try {
    const windows = app.windows();
    return windows.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  APP_PATH,
  launchApp,
  closeApp,
  waitForWebSocketServer,
  takeScreenshot,
  getWebview,
  executeInWindow,
  waitForElement,
  typeInto,
  clickElement,
  getConsoleLogs,
  waitForNavigation,
  elementExists,
  getElementText,
  getElementAttribute,
  getInputValue,
  setInputValue,
  pressShortcut,
  getWindowBounds,
  isAppRunning
};

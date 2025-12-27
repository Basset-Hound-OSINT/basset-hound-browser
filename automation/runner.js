/**
 * Script Runner Module
 * Handles execution of automation scripts in the browser context
 */

const { ipcMain } = require('electron');

/**
 * ScriptRunner class for executing automation scripts
 */
class ScriptRunner {
  /**
   * Create a new ScriptRunner
   * @param {BrowserWindow} mainWindow - Main Electron window
   */
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Set the main window reference
   * @param {BrowserWindow} mainWindow - Main Electron window
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Execute an automation script
   * @param {AutomationScript} script - Script to execute
   * @param {Object} context - Execution context
   * @returns {Object} Execution result
   */
  async executeScript(script, context = {}) {
    const startTime = Date.now();

    try {
      if (!this.mainWindow) {
        return {
          success: false,
          error: 'No window available for script execution'
        };
      }

      // Build the complete script with helper functions
      const wrappedScript = this.wrapScript(script.script, context);

      // Execute the script in the webview
      const result = await this.executeInWebview(wrappedScript);

      const executionRecord = {
        scriptId: script.id,
        scriptName: script.name,
        startTime: new Date(startTime).toISOString(),
        duration: Date.now() - startTime,
        success: result.success,
        context,
        error: result.error || null
      };

      this.addToHistory(executionRecord);

      console.log(`[ScriptRunner] Executed script: ${script.name} in ${executionRecord.duration}ms`);

      return {
        success: result.success,
        result: result.result,
        duration: executionRecord.duration,
        error: result.error
      };
    } catch (error) {
      const executionRecord = {
        scriptId: script.id,
        scriptName: script.name,
        startTime: new Date(startTime).toISOString(),
        duration: Date.now() - startTime,
        success: false,
        context,
        error: error.message
      };

      this.addToHistory(executionRecord);

      console.error(`[ScriptRunner] Error executing script ${script.name}:`, error);

      return {
        success: false,
        error: error.message,
        duration: executionRecord.duration
      };
    }
  }

  /**
   * Wrap user script with helper functions and error handling
   * @param {string} userScript - User's script code
   * @param {Object} context - Execution context
   * @returns {string} Wrapped script
   */
  wrapScript(userScript, context) {
    return `
      (async function() {
        // Execution context
        const __context = ${JSON.stringify(context)};

        // Helper functions available to scripts
        const helpers = {
          /**
           * Wait for an element to appear in the DOM
           * @param {string} selector - CSS selector
           * @param {number} timeout - Timeout in milliseconds
           * @returns {Promise<Element>} The found element
           */
          waitForElement: async function(selector, timeout = 10000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const element = document.querySelector(selector);
              if (element) return element;
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw new Error(\`Element not found: \${selector}\`);
          },

          /**
           * Click an element
           * @param {string} selector - CSS selector
           */
          click: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            element.click();
            return { clicked: true, selector };
          },

          /**
           * Fill an input field with text
           * @param {string} selector - CSS selector
           * @param {string} value - Value to fill
           */
          fill: async function(selector, value) {
            const element = await helpers.waitForElement(selector, 5000);
            element.focus();
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { filled: true, selector, value };
          },

          /**
           * Get text content from an element
           * @param {string} selector - CSS selector
           * @returns {string} Text content
           */
          getText: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            return element.textContent || element.innerText;
          },

          /**
           * Get attribute from an element
           * @param {string} selector - CSS selector
           * @param {string} attribute - Attribute name
           * @returns {string} Attribute value
           */
          getAttribute: async function(selector, attribute) {
            const element = await helpers.waitForElement(selector, 5000);
            return element.getAttribute(attribute);
          },

          /**
           * Check if an element exists
           * @param {string} selector - CSS selector
           * @returns {boolean} Whether element exists
           */
          exists: function(selector) {
            return document.querySelector(selector) !== null;
          },

          /**
           * Wait for a specified time
           * @param {number} ms - Milliseconds to wait
           */
          wait: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
          },

          /**
           * Scroll to an element or position
           * @param {string|Object} target - CSS selector or {x, y} coordinates
           */
          scrollTo: async function(target) {
            if (typeof target === 'string') {
              const element = await helpers.waitForElement(target, 5000);
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              window.scrollTo({ top: target.y || 0, left: target.x || 0, behavior: 'smooth' });
            }
            return { scrolled: true, target };
          },

          /**
           * Get all elements matching a selector
           * @param {string} selector - CSS selector
           * @returns {Element[]} Array of elements
           */
          queryAll: function(selector) {
            return Array.from(document.querySelectorAll(selector));
          },

          /**
           * Get element value (for inputs)
           * @param {string} selector - CSS selector
           * @returns {string} Element value
           */
          getValue: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            return element.value;
          },

          /**
           * Select an option in a dropdown
           * @param {string} selector - CSS selector for select element
           * @param {string} value - Value to select
           */
          select: async function(selector, value) {
            const element = await helpers.waitForElement(selector, 5000);
            element.value = value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { selected: true, selector, value };
          },

          /**
           * Check or uncheck a checkbox
           * @param {string} selector - CSS selector
           * @param {boolean} checked - Whether to check or uncheck
           */
          setChecked: async function(selector, checked = true) {
            const element = await helpers.waitForElement(selector, 5000);
            if (element.checked !== checked) {
              element.click();
            }
            return { checked: element.checked, selector };
          },

          /**
           * Submit a form
           * @param {string} selector - CSS selector for form or submit button
           */
          submit: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            if (element.tagName === 'FORM') {
              element.submit();
            } else {
              element.click();
            }
            return { submitted: true, selector };
          },

          /**
           * Focus an element
           * @param {string} selector - CSS selector
           */
          focus: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            element.focus();
            return { focused: true, selector };
          },

          /**
           * Blur (unfocus) an element
           * @param {string} selector - CSS selector
           */
          blur: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            element.blur();
            return { blurred: true, selector };
          },

          /**
           * Get current URL
           * @returns {string} Current page URL
           */
          getUrl: function() {
            return window.location.href;
          },

          /**
           * Get page title
           * @returns {string} Page title
           */
          getTitle: function() {
            return document.title;
          },

          /**
           * Store data in session storage
           * @param {string} key - Storage key
           * @param {*} value - Value to store
           */
          store: function(key, value) {
            sessionStorage.setItem('__automation_' + key, JSON.stringify(value));
            return { stored: true, key };
          },

          /**
           * Retrieve data from session storage
           * @param {string} key - Storage key
           * @returns {*} Stored value
           */
          retrieve: function(key) {
            const value = sessionStorage.getItem('__automation_' + key);
            return value ? JSON.parse(value) : null;
          },

          /**
           * Log a message (will be captured in script output)
           * @param {...*} args - Arguments to log
           */
          log: function(...args) {
            console.log('[AutomationScript]', ...args);
            if (!window.__automationLogs) window.__automationLogs = [];
            window.__automationLogs.push({ time: new Date().toISOString(), args });
          },

          /**
           * Take a screenshot (placeholder - actual implementation in main process)
           * @returns {Object} Screenshot indicator
           */
          screenshot: function() {
            return { action: 'screenshot', requested: true };
          },

          /**
           * Get the execution context
           * @returns {Object} Context object
           */
          getContext: function() {
            return __context;
          },

          /**
           * Dispatch a custom event
           * @param {string} selector - CSS selector
           * @param {string} eventType - Event type
           * @param {Object} eventInit - Event initialization options
           */
          dispatchEvent: async function(selector, eventType, eventInit = {}) {
            const element = await helpers.waitForElement(selector, 5000);
            const event = new Event(eventType, { bubbles: true, ...eventInit });
            element.dispatchEvent(event);
            return { dispatched: true, selector, eventType };
          },

          /**
           * Simulate keyboard input on an element
           * @param {string} selector - CSS selector
           * @param {string} key - Key to press
           * @param {Object} options - Keyboard event options
           */
          pressKey: async function(selector, key, options = {}) {
            const element = await helpers.waitForElement(selector, 5000);
            element.focus();

            const keydownEvent = new KeyboardEvent('keydown', {
              key,
              bubbles: true,
              cancelable: true,
              ...options
            });
            element.dispatchEvent(keydownEvent);

            const keyupEvent = new KeyboardEvent('keyup', {
              key,
              bubbles: true,
              cancelable: true,
              ...options
            });
            element.dispatchEvent(keyupEvent);

            return { pressed: true, key, selector };
          },

          /**
           * Get computed style of an element
           * @param {string} selector - CSS selector
           * @param {string} property - CSS property name
           * @returns {string} Computed style value
           */
          getStyle: async function(selector, property) {
            const element = await helpers.waitForElement(selector, 5000);
            return window.getComputedStyle(element).getPropertyValue(property);
          },

          /**
           * Check if element is visible
           * @param {string} selector - CSS selector
           * @returns {boolean} Whether element is visible
           */
          isVisible: async function(selector) {
            try {
              const element = await helpers.waitForElement(selector, 1000);
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none'
              );
            } catch {
              return false;
            }
          },

          /**
           * Get element bounding rectangle
           * @param {string} selector - CSS selector
           * @returns {DOMRect} Bounding rectangle
           */
          getBounds: async function(selector) {
            const element = await helpers.waitForElement(selector, 5000);
            return element.getBoundingClientRect();
          }
        };

        // Make helpers available globally within script
        const waitForElement = helpers.waitForElement;
        const click = helpers.click;
        const fill = helpers.fill;
        const getText = helpers.getText;
        const getAttribute = helpers.getAttribute;
        const exists = helpers.exists;
        const wait = helpers.wait;
        const scrollTo = helpers.scrollTo;
        const queryAll = helpers.queryAll;
        const getValue = helpers.getValue;
        const select = helpers.select;
        const setChecked = helpers.setChecked;
        const submit = helpers.submit;
        const focus = helpers.focus;
        const blur = helpers.blur;
        const getUrl = helpers.getUrl;
        const getTitle = helpers.getTitle;
        const store = helpers.store;
        const retrieve = helpers.retrieve;
        const log = helpers.log;
        const screenshot = helpers.screenshot;
        const getContext = helpers.getContext;
        const dispatchEvent = helpers.dispatchEvent;
        const pressKey = helpers.pressKey;
        const getStyle = helpers.getStyle;
        const isVisible = helpers.isVisible;
        const getBounds = helpers.getBounds;

        try {
          // Execute user script
          const __result = await (async () => {
            ${userScript}
          })();

          return {
            success: true,
            result: __result,
            logs: window.__automationLogs || []
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            stack: error.stack,
            logs: window.__automationLogs || []
          };
        } finally {
          // Clean up logs
          window.__automationLogs = [];
        }
      })();
    `;
  }

  /**
   * Execute script in webview
   * @param {string} script - Script to execute
   * @returns {Promise<Object>} Execution result
   */
  executeInWebview(script) {
    return new Promise((resolve, reject) => {
      if (!this.mainWindow) {
        reject(new Error('No window available'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Script execution timeout'));
      }, 60000); // 60 second timeout

      this.mainWindow.webContents.send('execute-in-webview', script);

      ipcMain.once('webview-execute-response', (event, result) => {
        clearTimeout(timeoutId);
        if (result && result.success !== undefined) {
          resolve(result);
        } else {
          resolve({
            success: true,
            result
          });
        }
      });
    });
  }

  /**
   * Check if URL matches a pattern
   * @param {string} pattern - URL pattern (glob-like or regex)
   * @param {string} url - URL to match
   * @returns {boolean} Whether URL matches pattern
   */
  matchesUrl(pattern, url) {
    if (!pattern || !url) return false;

    try {
      // Check if pattern is a regex (starts and ends with /)
      if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        const lastSlash = pattern.lastIndexOf('/');
        const regexBody = pattern.slice(1, lastSlash);
        const regexFlags = pattern.slice(lastSlash + 1);
        const regex = new RegExp(regexBody, regexFlags);
        return regex.test(url);
      }

      // Convert glob-like pattern to regex
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except * and ?
        .replace(/\*/g, '.*') // * matches any characters
        .replace(/\?/g, '.'); // ? matches single character

      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(url);
    } catch (error) {
      console.error(`[ScriptRunner] Error matching URL pattern: ${pattern}`, error);
      return false;
    }
  }

  /**
   * Get available context for scripts
   * @returns {Object} Available context
   */
  getAvailableContext() {
    return {
      helperFunctions: [
        'waitForElement(selector, timeout)',
        'click(selector)',
        'fill(selector, value)',
        'getText(selector)',
        'getAttribute(selector, attribute)',
        'exists(selector)',
        'wait(ms)',
        'scrollTo(target)',
        'queryAll(selector)',
        'getValue(selector)',
        'select(selector, value)',
        'setChecked(selector, checked)',
        'submit(selector)',
        'focus(selector)',
        'blur(selector)',
        'getUrl()',
        'getTitle()',
        'store(key, value)',
        'retrieve(key)',
        'log(...args)',
        'screenshot()',
        'getContext()',
        'dispatchEvent(selector, eventType, eventInit)',
        'pressKey(selector, key, options)',
        'getStyle(selector, property)',
        'isVisible(selector)',
        'getBounds(selector)'
      ],
      contextProperties: [
        'url - Current page URL (if available)',
        'trigger - What triggered the script (manual, on-load, on-url-match)'
      ]
    };
  }

  /**
   * Add execution to history
   * @param {Object} record - Execution record
   */
  addToHistory(record) {
    this.executionHistory.unshift(record);

    // Trim history if too large
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get execution history
   * @param {Object} options - Filter options
   * @returns {Object[]} Execution history
   */
  getHistory(options = {}) {
    let history = [...this.executionHistory];

    if (options.scriptId) {
      history = history.filter(h => h.scriptId === options.scriptId);
    }

    if (options.success !== undefined) {
      history = history.filter(h => h.success === options.success);
    }

    const limit = options.limit || 50;
    return history.slice(0, limit);
  }

  /**
   * Clear execution history
   */
  clearHistory() {
    this.executionHistory = [];
    console.log('[ScriptRunner] Execution history cleared');
  }
}

module.exports = ScriptRunner;

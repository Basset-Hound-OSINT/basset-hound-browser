/**
 * Basset Hound Browser - WebSocket Test Client
 * Utility for connecting to and communicating with the WebSocket server
 */

const WebSocket = require('ws');

/**
 * WebSocket Test Client class
 * Provides a convenient interface for testing WebSocket commands
 */
class WebSocketTestClient {
  /**
   * Create a WebSocket test client
   * @param {Object} options - Client options
   */
  constructor(options = {}) {
    this.url = options.url || 'ws://localhost:8765';
    this.connectTimeout = options.connectTimeout || 10000;
    this.commandTimeout = options.commandTimeout || 30000;
    this.verbose = options.verbose || false;

    this.ws = null;
    this.connected = false;
    this.messageId = 1;
    this.pendingCommands = new Map();
    this.messageHistory = [];
    this.eventHandlers = new Map();
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new Error('Connection timeout'));
      }, this.connectTimeout);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.log('Connected to WebSocket server');

        // Wait for connection confirmation message
        this.ws.once('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.log('Connection confirmed:', message);
            resolve();
          } catch (error) {
            resolve(); // Still resolve even if message isn't JSON
          }
        });
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.log('WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.log(`WebSocket closed: ${code} ${reason}`);
        this.emit('close', { code, reason });
      });
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Handle incoming message
   * @param {Buffer} data - Message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.messageHistory.push({
        timestamp: new Date().toISOString(),
        direction: 'in',
        message
      });

      this.log('Received:', message);

      // Resolve pending command if this is a response
      if (message.id && this.pendingCommands.has(message.id)) {
        const { resolve } = this.pendingCommands.get(message.id);
        this.pendingCommands.delete(message.id);
        resolve(message);
      }

      // Emit message event
      this.emit('message', message);
    } catch (error) {
      this.log('Failed to parse message:', error.message);
    }
  }

  /**
   * Send a command and wait for response
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} - Command response
   */
  async send(command, params = {}, timeout = null) {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected');
    }

    const id = `test-${Date.now()}-${this.messageId++}`;
    const message = { id, command, ...params };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout || this.commandTimeout);

      this.pendingCommands.set(id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        }
      });

      this.messageHistory.push({
        timestamp: new Date().toISOString(),
        direction: 'out',
        message
      });

      this.log('Sending:', message);
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Send raw message without waiting for response
   * @param {Object|string} message - Message to send
   */
  sendRaw(message) {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected');
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.ws.send(data);
  }

  // Command shortcuts

  /**
   * Ping the server
   * @returns {Promise<Object>}
   */
  ping() {
    return this.send('ping');
  }

  /**
   * Get server status
   * @returns {Promise<Object>}
   */
  status() {
    return this.send('status');
  }

  /**
   * Navigate to URL
   * @param {string} url - URL to navigate to
   * @returns {Promise<Object>}
   */
  navigate(url) {
    return this.send('navigate', { url });
  }

  /**
   * Click element
   * @param {string} selector - CSS selector
   * @param {Object} options - Click options
   * @returns {Promise<Object>}
   */
  click(selector, options = {}) {
    return this.send('click', { selector, ...options });
  }

  /**
   * Fill input field
   * @param {string} selector - CSS selector
   * @param {string} value - Value to fill
   * @param {Object} options - Fill options
   * @returns {Promise<Object>}
   */
  fill(selector, value, options = {}) {
    return this.send('fill', { selector, value, ...options });
  }

  /**
   * Execute JavaScript
   * @param {string} script - JavaScript code
   * @returns {Promise<Object>}
   */
  executeScript(script) {
    return this.send('execute_script', { script });
  }

  /**
   * Wait for element
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>}
   */
  waitForElement(selector, timeout = 10000) {
    return this.send('wait_for_element', { selector, timeout });
  }

  /**
   * Get page content
   * @returns {Promise<Object>}
   */
  getContent() {
    return this.send('get_content');
  }

  /**
   * Get current URL
   * @returns {Promise<Object>}
   */
  getUrl() {
    return this.send('get_url');
  }

  /**
   * Take screenshot
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>}
   */
  screenshot(options = {}) {
    return this.send('screenshot', options);
  }

  /**
   * Scroll page
   * @param {Object} options - Scroll options
   * @returns {Promise<Object>}
   */
  scroll(options = {}) {
    return this.send('scroll', options);
  }

  /**
   * Get cookies
   * @param {string} url - URL to get cookies for
   * @returns {Promise<Object>}
   */
  getCookies(url) {
    return this.send('get_cookies', { url });
  }

  /**
   * Set cookies
   * @param {Array} cookies - Cookies to set
   * @returns {Promise<Object>}
   */
  setCookies(cookies) {
    return this.send('set_cookies', { cookies });
  }

  /**
   * Go back in history
   * @returns {Promise<Object>}
   */
  goBack() {
    return this.send('go_back');
  }

  /**
   * Go forward in history
   * @returns {Promise<Object>}
   */
  goForward() {
    return this.send('go_forward');
  }

  /**
   * Reload page
   * @param {Object} options - Reload options
   * @returns {Promise<Object>}
   */
  reload(options = {}) {
    return this.send('reload', options);
  }

  /**
   * Move mouse
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Move options
   * @returns {Promise<Object>}
   */
  mouseMove(x, y, options = {}) {
    return this.send('mouse_move', { x, y, ...options });
  }

  /**
   * Click at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Click options
   * @returns {Promise<Object>}
   */
  mouseClick(x, y, options = {}) {
    return this.send('mouse_click', { x, y, ...options });
  }

  /**
   * Type text
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   * @returns {Promise<Object>}
   */
  typeText(text, options = {}) {
    return this.send('type_text', { text, ...options });
  }

  /**
   * Press key
   * @param {string} key - Key to press
   * @param {Object} options - Key options
   * @returns {Promise<Object>}
   */
  keyPress(key, options = {}) {
    return this.send('key_press', { key, ...options });
  }

  /**
   * Press key combination
   * @param {Array} keys - Keys to press
   * @param {Object} options - Options
   * @returns {Promise<Object>}
   */
  keyCombination(keys, options = {}) {
    return this.send('key_combination', { keys, ...options });
  }

  // Event handling

  /**
   * Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)) {
        handler(data);
      }
    }
  }

  // Utility methods

  /**
   * Get message history
   * @returns {Array} - Message history
   */
  getHistory() {
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Wait for specific message
   * @param {Function} predicate - Function to test messages
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>}
   */
  waitForMessage(predicate, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off('message', handler);
        reject(new Error('Wait for message timeout'));
      }, timeout);

      const handler = (message) => {
        if (predicate(message)) {
          clearTimeout(timeoutId);
          this.off('message', handler);
          resolve(message);
        }
      };

      this.on('message', handler);
    });
  }

  /**
   * Log message if verbose
   * @param {...any} args - Log arguments
   */
  log(...args) {
    if (this.verbose) {
      console.log('[WebSocketTestClient]', ...args);
    }
  }
}

/**
 * Create and connect a WebSocket test client
 * @param {Object} options - Client options
 * @returns {Promise<WebSocketTestClient>}
 */
async function createClient(options = {}) {
  const client = new WebSocketTestClient(options);
  await client.connect();
  return client;
}

/**
 * Wait for WebSocket server to be available
 * @param {string} url - WebSocket URL
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForServer(url = 'ws://localhost:8765', timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const client = new WebSocketTestClient({ url, connectTimeout: 2000 });
      await client.connect();
      client.disconnect();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return false;
}

module.exports = {
  WebSocketTestClient,
  createClient,
  waitForServer
};

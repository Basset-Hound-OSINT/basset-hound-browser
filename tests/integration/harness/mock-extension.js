/**
 * Mock Extension Client
 *
 * Simulates a Chrome extension client connecting to the Basset Hound browser's
 * WebSocket server for integration testing.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Mock Extension Client for integration testing
 */
class MockExtension extends EventEmitter {
  constructor(options = {}) {
    super();

    this.url = options.url || 'ws://localhost:8765';
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.heartbeatInterval = null;
    this.pendingCommands = new Map();
    this.messageIdCounter = 1;

    // Configuration
    this.config = {
      autoReconnect: options.autoReconnect !== false,
      heartbeatMs: options.heartbeatMs || 30000,
      commandTimeout: options.commandTimeout || 30000,
      clientType: options.clientType || 'extension',
      ...options
    };

    // State
    this.state = {
      currentUrl: null,
      pageTitle: null,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      networkRequests: []
    };

    // Command handlers (for commands from browser)
    this.commandHandlers = new Map();
    this.setupDefaultHandlers();
  }

  /**
   * Setup default command handlers
   */
  setupDefaultHandlers() {
    // Navigate handler
    this.commandHandlers.set('navigate', async (params) => {
      const { url, wait_for } = params;
      this.state.currentUrl = url;
      this.emit('navigate', { url, wait_for });

      // Simulate navigation delay
      await this.delay(100);

      return { url, loaded: true };
    });

    // Fill form handler
    this.commandHandlers.set('fill_form', async (params) => {
      const { fields, submit } = params;
      this.emit('fillForm', { fields, submit });

      const filledFields = Object.keys(fields);
      return {
        filled: filledFields,
        submitted: submit || false
      };
    });

    // Click handler
    this.commandHandlers.set('click', async (params) => {
      const { selector, wait_after } = params;
      this.emit('click', { selector, wait_after });

      if (wait_after) {
        await this.delay(wait_after);
      }

      return { clicked: selector };
    });

    // Get content handler
    this.commandHandlers.set('get_content', async (params) => {
      const { selector } = params;
      this.emit('getContent', { selector });

      return {
        success: true,
        content: `<html><body>Mock content for ${selector || 'body'}</body></html>`,
        url: this.state.currentUrl
      };
    });

    // Screenshot handler
    this.commandHandlers.set('screenshot', async (params) => {
      this.emit('screenshot', params);

      return {
        success: true,
        screenshot: 'data:image/png;base64,mockScreenshotData',
        format: params.format || 'png'
      };
    });

    // Get page state handler
    this.commandHandlers.set('get_page_state', async () => {
      this.emit('getPageState');

      return {
        success: true,
        url: this.state.currentUrl,
        title: this.state.pageTitle || 'Mock Page',
        forms: [],
        links: [],
        buttons: []
      };
    });

    // Wait for element handler
    this.commandHandlers.set('wait_for_element', async (params) => {
      const { selector, timeout } = params;
      this.emit('waitForElement', { selector, timeout });

      // Simulate finding element
      await this.delay(50);

      return {
        success: true,
        found: true,
        selector
      };
    });

    // Execute script handler
    this.commandHandlers.set('execute_script', async (params) => {
      const { script } = params;
      this.emit('executeScript', { script });

      return {
        success: true,
        result: 'Mock script execution result'
      };
    });

    // Get cookies handler
    this.commandHandlers.set('get_cookies', async (params) => {
      return {
        success: true,
        cookies: this.state.cookies,
        count: this.state.cookies.length
      };
    });

    // Set cookies handler
    this.commandHandlers.set('set_cookies', async (params) => {
      const { cookies } = params;
      this.state.cookies = [...this.state.cookies, ...cookies];
      return {
        success: true,
        count: cookies.length
      };
    });

    // Get local storage handler
    this.commandHandlers.set('get_local_storage', async (params) => {
      const { keys } = params;
      if (keys) {
        const items = {};
        keys.forEach(key => {
          if (this.state.localStorage[key] !== undefined) {
            items[key] = this.state.localStorage[key];
          }
        });
        return { success: true, items };
      }
      return { success: true, items: this.state.localStorage };
    });

    // Set local storage handler
    this.commandHandlers.set('set_local_storage', async (params) => {
      const { items } = params;
      Object.assign(this.state.localStorage, items);
      return { success: true, count: Object.keys(items).length };
    });

    // Network capture handlers
    this.commandHandlers.set('start_network_capture', async () => {
      return { success: true, capturing: true };
    });

    this.commandHandlers.set('stop_network_capture', async () => {
      return {
        success: true,
        capturing: false,
        log: this.state.networkRequests
      };
    });

    this.commandHandlers.set('get_network_log', async () => {
      return {
        success: true,
        log: this.state.networkRequests,
        count: this.state.networkRequests.length
      };
    });
  }

  /**
   * Connect to the WebSocket server
   * @returns {Promise} Resolves when connected
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(this);
        return;
      }

      try {
        this.ws = new WebSocket(this.url);

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log(`[MockExtension] Connected to ${this.url}`);

          // Start heartbeat
          this.startHeartbeat();

          // Send initial status
          this.sendStatus('connected');

          this.emit('connected');
          resolve(this);
        });

        this.ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            await this.handleMessage(message);
          } catch (error) {
            console.error('[MockExtension] Message parse error:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          this.stopHeartbeat();
          console.log(`[MockExtension] Disconnected (code: ${code})`);
          this.emit('disconnected', { code, reason: reason.toString() });

          if (this.config.autoReconnect && code !== 1000) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          console.error('[MockExtension] WebSocket error:', error);
          this.emit('error', error);
          if (!this.isConnected) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    this.config.autoReconnect = false;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[MockExtension] Max reconnect attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[MockExtension] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        // Will trigger another reconnect via close handler
      });
    }, delay);
  }

  /**
   * Handle incoming message
   * @param {Object} message - Parsed message
   */
  async handleMessage(message) {
    this.emit('message', message);

    // Handle status message
    if (message.type === 'status') {
      this.emit('serverStatus', message);
      return;
    }

    // Handle command from browser
    if (message.command_id && message.type) {
      await this.processCommand(message);
      return;
    }

    // Handle response to our command
    if (message.id && this.pendingCommands.has(message.id)) {
      const { resolve } = this.pendingCommands.get(message.id);
      this.pendingCommands.delete(message.id);
      resolve(message);
      return;
    }
  }

  /**
   * Process command from browser
   * @param {Object} command - Command object
   */
  async processCommand(command) {
    const { command_id, type, params = {} } = command;
    const handler = this.commandHandlers.get(type);

    let response;
    if (handler) {
      try {
        const result = await handler(params);
        response = {
          command_id,
          success: true,
          result,
          timestamp: Date.now()
        };
      } catch (error) {
        response = {
          command_id,
          success: false,
          error: error.message,
          timestamp: Date.now()
        };
      }
    } else {
      response = {
        command_id,
        success: false,
        error: `Unknown command type: ${type}`,
        timestamp: Date.now()
      };
    }

    this.send(response);
  }

  /**
   * Send message to server
   * @param {Object} message - Message to send
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send command to browser and wait for response
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @param {number} timeout - Response timeout
   * @returns {Promise<Object>} Response
   */
  sendCommand(command, params = {}, timeout = this.config.commandTimeout) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected'));
        return;
      }

      const id = `ext-${Date.now()}-${this.messageIdCounter++}`;

      const message = {
        id,
        command,
        ...params
      };

      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      this.pendingCommands.set(id, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });

      this.send(message);
    });
  }

  /**
   * Send status update
   * @param {string} status - Status message
   * @param {Object} data - Additional data
   */
  sendStatus(status, data = {}) {
    this.send({
      type: 'status',
      status,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      }
    }, this.config.heartbeatMs);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Register a command handler
   * @param {string} command - Command name
   * @param {Function} handler - Handler function
   */
  registerHandler(command, handler) {
    this.commandHandlers.set(command, handler);
  }

  /**
   * Simulate navigation
   * @param {string} url - URL to navigate to
   */
  simulateNavigation(url, title = null) {
    this.state.currentUrl = url;
    this.state.pageTitle = title || `Page: ${url}`;
    this.emit('navigated', { url, title: this.state.pageTitle });
  }

  /**
   * Simulate adding a cookie
   * @param {Object} cookie - Cookie object
   */
  simulateCookie(cookie) {
    this.state.cookies.push(cookie);
  }

  /**
   * Simulate a network request
   * @param {Object} request - Request object
   */
  simulateNetworkRequest(request) {
    this.state.networkRequests.push({
      id: `req-${Date.now()}`,
      timestamp: Date.now(),
      ...request
    });
  }

  /**
   * Reset state
   */
  resetState() {
    this.state = {
      currentUrl: null,
      pageTitle: null,
      cookies: [],
      localStorage: {},
      sessionStorage: {},
      networkRequests: []
    };
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }
}

module.exports = { MockExtension };

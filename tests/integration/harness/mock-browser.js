/**
 * Mock Browser Client
 *
 * Simulates the Electron browser client for integration testing.
 * This mock represents the browser-side WebSocket client that connects
 * to the WebSocket server and handles commands.
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * Mock Browser Client for integration testing
 */
class MockBrowser extends EventEmitter {
  constructor(options = {}) {
    super();

    this.url = options.url || 'ws://localhost:8765';
    this.ws = null;
    this.isConnected = false;
    this.pendingCommands = new Map();
    this.messageIdCounter = 1;
    this.clientId = null;

    // Configuration
    this.config = {
      commandTimeout: options.commandTimeout || 30000,
      clientType: options.clientType || 'browser',
      ...options
    };

    // Browser state
    this.state = {
      currentUrl: 'about:blank',
      pageTitle: 'New Tab',
      tabs: new Map(),
      activeTabId: null,
      sessions: new Map(),
      activeSessionId: 'default',
      cookies: [],
      history: [],
      downloads: [],
      recording: { state: 'stopped' }
    };

    // Initialize default tab
    this.createTab({ url: 'about:blank', active: true });
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
          console.log(`[MockBrowser] Connected to ${this.url}`);

          this.emit('connected');
          resolve(this);
        });

        this.ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            await this.handleMessage(message);
          } catch (error) {
            console.error('[MockBrowser] Message parse error:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          this.isConnected = false;
          console.log(`[MockBrowser] Disconnected (code: ${code})`);
          this.emit('disconnected', { code, reason: reason.toString() });
        });

        this.ws.on('error', (error) => {
          console.error('[MockBrowser] WebSocket error:', error);
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
    if (this.ws) {
      this.ws.close(1000, 'Browser disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Handle incoming message
   * @param {Object} message - Parsed message
   */
  async handleMessage(message) {
    this.emit('message', message);

    // Handle status/welcome message
    if (message.type === 'status') {
      if (message.clientId) {
        this.clientId = message.clientId;
      }
      this.emit('serverStatus', message);
      return;
    }

    // Handle command from server
    if (message.command) {
      const response = await this.processCommand(message);
      this.send({
        id: message.id,
        command: message.command,
        ...response
      });
      return;
    }

    // Handle response to our command
    if (message.command_id && this.pendingCommands.has(message.command_id)) {
      const { resolve } = this.pendingCommands.get(message.command_id);
      this.pendingCommands.delete(message.command_id);
      resolve(message);
      return;
    }
  }

  /**
   * Process command and return response
   * @param {Object} message - Command message
   */
  async processCommand(message) {
    const { command, ...params } = message;

    this.emit('command', { command, params });

    try {
      switch (command) {
        case 'ping':
          return { success: true, message: 'pong', timestamp: Date.now() };

        case 'status':
          return {
            success: true,
            status: {
              ready: true,
              tabs: this.state.tabs.size,
              activeTab: this.state.activeTabId,
              sessions: this.state.sessions.size,
              activeSession: this.state.activeSessionId,
              recording: this.state.recording
            }
          };

        case 'navigate':
          return this.handleNavigate(params);

        case 'get_url':
          return { success: true, url: this.state.currentUrl };

        case 'click':
          return this.handleClick(params);

        case 'fill':
          return this.handleFill(params);

        case 'get_content':
          return this.handleGetContent(params);

        case 'screenshot':
        case 'screenshot_viewport':
          return this.handleScreenshot(params);

        case 'screenshot_full_page':
          return this.handleFullPageScreenshot(params);

        case 'screenshot_element':
          return this.handleElementScreenshot(params);

        case 'execute_script':
          return this.handleExecuteScript(params);

        case 'wait_for_element':
          return this.handleWaitForElement(params);

        case 'scroll':
          return this.handleScroll(params);

        case 'get_cookies':
          return this.handleGetCookies(params);

        case 'set_cookies':
          return this.handleSetCookies(params);

        case 'get_page_state':
          return this.handleGetPageState(params);

        // Tab management
        case 'new_tab':
          return this.handleNewTab(params);

        case 'close_tab':
          return this.handleCloseTab(params);

        case 'switch_tab':
          return this.handleSwitchTab(params);

        case 'list_tabs':
          return this.handleListTabs(params);

        // Session management
        case 'create_session':
          return this.handleCreateSession(params);

        case 'switch_session':
          return this.handleSwitchSession(params);

        case 'list_sessions':
          return this.handleListSessions(params);

        // Recording
        case 'start_recording':
          return this.handleStartRecording(params);

        case 'stop_recording':
          return this.handleStopRecording(params);

        case 'recording_status':
          return { success: true, ...this.state.recording };

        default:
          return { success: false, error: `Unknown command: ${command}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle navigate command
   */
  handleNavigate(params) {
    const { url } = params;
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    this.state.currentUrl = url;
    this.state.pageTitle = `Page: ${url}`;

    // Update active tab
    const activeTab = this.state.tabs.get(this.state.activeTabId);
    if (activeTab) {
      activeTab.url = url;
      activeTab.title = this.state.pageTitle;
    }

    // Add to history
    this.state.history.push({
      url,
      title: this.state.pageTitle,
      timestamp: new Date().toISOString()
    });

    this.emit('navigated', { url });
    return { success: true, url };
  }

  /**
   * Handle click command
   */
  handleClick(params) {
    const { selector } = params;
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    this.emit('clicked', { selector });
    return { success: true, selector };
  }

  /**
   * Handle fill command
   */
  handleFill(params) {
    const { selector, value } = params;
    if (!selector || value === undefined) {
      return { success: false, error: 'Selector and value are required' };
    }

    this.emit('filled', { selector, value });
    return { success: true, selector, value };
  }

  /**
   * Handle get content command
   */
  handleGetContent(params) {
    return {
      success: true,
      content: `<html><head><title>${this.state.pageTitle}</title></head><body>Mock content</body></html>`,
      url: this.state.currentUrl
    };
  }

  /**
   * Handle screenshot command
   */
  handleScreenshot(params) {
    const { format = 'png' } = params;
    return {
      success: true,
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      format,
      width: 1920,
      height: 1080
    };
  }

  /**
   * Handle full page screenshot command
   */
  handleFullPageScreenshot(params) {
    return {
      ...this.handleScreenshot(params),
      fullPage: true,
      height: 3000
    };
  }

  /**
   * Handle element screenshot command
   */
  handleElementScreenshot(params) {
    const { selector } = params;
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    return {
      ...this.handleScreenshot(params),
      element: selector,
      bounds: { x: 100, y: 100, width: 200, height: 100 }
    };
  }

  /**
   * Handle execute script command
   */
  handleExecuteScript(params) {
    const { script } = params;
    if (!script) {
      return { success: false, error: 'Script is required' };
    }

    // Simulate some basic script results
    if (script.includes('navigator.userAgent')) {
      return { success: true, result: 'Mozilla/5.0 Mock Browser' };
    }
    if (script.includes('document.title')) {
      return { success: true, result: this.state.pageTitle };
    }

    return { success: true, result: null };
  }

  /**
   * Handle wait for element command
   */
  handleWaitForElement(params) {
    const { selector, timeout } = params;
    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    // Simulate finding element
    return { success: true, found: true, selector };
  }

  /**
   * Handle scroll command
   */
  handleScroll(params) {
    const { x, y, selector } = params;
    this.emit('scrolled', { x, y, selector });
    return { success: true, x: x || 0, y: y || 0 };
  }

  /**
   * Handle get cookies command
   */
  handleGetCookies(params) {
    const { url } = params;
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    const cookies = this.state.cookies.filter(c => {
      try {
        const cookieUrl = new URL(url);
        return c.domain === cookieUrl.hostname ||
               cookieUrl.hostname.endsWith(c.domain.replace(/^\./, ''));
      } catch {
        return false;
      }
    });

    return { success: true, cookies };
  }

  /**
   * Handle set cookies command
   */
  handleSetCookies(params) {
    const { cookies } = params;
    if (!cookies || !Array.isArray(cookies)) {
      return { success: false, error: 'Cookies array is required' };
    }

    this.state.cookies.push(...cookies);
    return { success: true };
  }

  /**
   * Handle get page state command
   */
  handleGetPageState(params) {
    return {
      success: true,
      url: this.state.currentUrl,
      title: this.state.pageTitle,
      forms: [{ id: 'form1', action: '/submit', method: 'POST', fields: [] }],
      links: [{ href: '/page1', text: 'Link 1' }],
      buttons: [{ text: 'Submit', type: 'submit' }]
    };
  }

  /**
   * Handle new tab command
   */
  handleNewTab(params) {
    const { url = 'about:blank', active = true } = params;
    const tab = this.createTab({ url, active });
    return { success: true, tab };
  }

  /**
   * Handle close tab command
   */
  handleCloseTab(params) {
    const { tabId } = params;
    if (!tabId) {
      return { success: false, error: 'Tab ID is required' };
    }

    if (!this.state.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    this.state.tabs.delete(tabId);

    if (this.state.activeTabId === tabId) {
      const remaining = Array.from(this.state.tabs.keys());
      this.state.activeTabId = remaining[0] || null;
    }

    return { success: true, closedTabId: tabId, activeTabId: this.state.activeTabId };
  }

  /**
   * Handle switch tab command
   */
  handleSwitchTab(params) {
    const { tabId } = params;
    if (!tabId) {
      return { success: false, error: 'Tab ID is required' };
    }

    if (!this.state.tabs.has(tabId)) {
      return { success: false, error: 'Tab not found' };
    }

    const previousTabId = this.state.activeTabId;
    this.state.activeTabId = tabId;
    const tab = this.state.tabs.get(tabId);

    this.state.currentUrl = tab.url;
    this.state.pageTitle = tab.title;

    return { success: true, tab, previousTabId };
  }

  /**
   * Handle list tabs command
   */
  handleListTabs(params) {
    const tabs = [];
    this.state.tabs.forEach((tab, id) => {
      tabs.push({
        ...tab,
        isActive: id === this.state.activeTabId
      });
    });

    return { success: true, tabs };
  }

  /**
   * Create a new tab
   */
  createTab(options = {}) {
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tab = {
      id: tabId,
      url: options.url || 'about:blank',
      title: options.title || 'New Tab',
      createdAt: new Date().toISOString()
    };

    this.state.tabs.set(tabId, tab);

    if (options.active || this.state.tabs.size === 1) {
      this.state.activeTabId = tabId;
      this.state.currentUrl = tab.url;
      this.state.pageTitle = tab.title;
    }

    return tab;
  }

  /**
   * Handle create session command
   */
  handleCreateSession(params) {
    const { name, userAgent, fingerprint } = params;
    const sessionId = `session-${Date.now()}`;

    const session = {
      id: sessionId,
      name: name || `Session ${sessionId}`,
      createdAt: new Date().toISOString(),
      userAgent,
      fingerprint
    };

    this.state.sessions.set(sessionId, session);

    return {
      success: true,
      session: {
        id: session.id,
        name: session.name,
        createdAt: session.createdAt
      }
    };
  }

  /**
   * Handle switch session command
   */
  handleSwitchSession(params) {
    const { sessionId } = params;
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' };
    }

    if (!this.state.sessions.has(sessionId) && sessionId !== 'default') {
      return { success: false, error: 'Session not found' };
    }

    this.state.activeSessionId = sessionId;

    return {
      success: true,
      sessionId,
      session: this.state.sessions.get(sessionId) || { id: 'default', name: 'Default Session' }
    };
  }

  /**
   * Handle list sessions command
   */
  handleListSessions(params) {
    const sessions = [{ id: 'default', name: 'Default Session', isActive: this.state.activeSessionId === 'default' }];

    this.state.sessions.forEach((session, id) => {
      sessions.push({
        ...session,
        isActive: id === this.state.activeSessionId
      });
    });

    return { success: true, sessions };
  }

  /**
   * Handle start recording command
   */
  handleStartRecording(params) {
    this.state.recording = {
      state: 'recording',
      startTime: Date.now(),
      format: params.format || 'webm',
      quality: params.quality || 'medium'
    };

    return { success: true, recordingId: `rec-${Date.now()}`, state: 'recording' };
  }

  /**
   * Handle stop recording command
   */
  handleStopRecording(params) {
    const startTime = this.state.recording.startTime;
    this.state.recording = { state: 'stopped' };

    return {
      success: true,
      state: 'stopped',
      duration: startTime ? Date.now() - startTime : 0,
      data: 'mock-recording-data'
    };
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
   * Send command to server and wait for response
   * @param {string} type - Command type
   * @param {Object} params - Command parameters
   * @param {number} timeout - Response timeout
   * @returns {Promise<Object>} Response
   */
  sendCommand(type, params = {}, timeout = this.config.commandTimeout) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected'));
        return;
      }

      const commandId = `browser-${Date.now()}-${this.messageIdCounter++}`;

      const command = {
        command_id: commandId,
        type,
        params
      };

      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout: ${type}`));
      }, timeout);

      this.pendingCommands.set(commandId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject
      });

      this.send(command);
    });
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      ...this.state,
      tabs: Array.from(this.state.tabs.values()),
      sessions: Array.from(this.state.sessions.values())
    };
  }

  /**
   * Reset state
   */
  resetState() {
    this.state = {
      currentUrl: 'about:blank',
      pageTitle: 'New Tab',
      tabs: new Map(),
      activeTabId: null,
      sessions: new Map(),
      activeSessionId: 'default',
      cookies: [],
      history: [],
      downloads: [],
      recording: { state: 'stopped' }
    };

    this.createTab({ url: 'about:blank', active: true });
  }
}

module.exports = { MockBrowser };

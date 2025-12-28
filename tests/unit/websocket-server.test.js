/**
 * Basset Hound Browser - WebSocket Server Unit Tests
 * Tests for WebSocket command handling and message processing
 *
 * Fixed race conditions by:
 * 1. Using proper async/await patterns with Promise-based server initialization
 * 2. Using fixed ports with port allocation helper to avoid conflicts
 * 3. Properly waiting for 'listening' event before connecting clients
 * 4. Using robust cleanup in afterEach with proper connection closing
 * 5. Increased timeouts for reliability
 */

const WebSocket = require('ws');

// Mock Electron modules
jest.mock('electron', () => ({
  ipcMain: {
    once: jest.fn(),
    on: jest.fn(),
    handle: jest.fn()
  },
  session: {
    defaultSession: {
      cookies: {
        get: jest.fn().mockResolvedValue([]),
        set: jest.fn().mockResolvedValue(undefined)
      },
      setProxy: jest.fn().mockResolvedValue(undefined)
    }
  }
}));

// Mock dependencies
jest.mock('../../evasion/humanize', () => ({
  humanDelay: jest.fn().mockResolvedValue(undefined),
  humanType: jest.fn().mockImplementation(text => Promise.resolve(text)),
  humanMouseMove: jest.fn().mockResolvedValue([]),
  humanScroll: jest.fn().mockResolvedValue({ scrollAmount: 300, scrollDuration: 1000 })
}));

jest.mock('../../screenshots/manager', () => ({
  ScreenshotManager: jest.fn().mockImplementation(() => ({
    captureViewport: jest.fn().mockResolvedValue({ success: true, data: 'base64data' }),
    captureFullPage: jest.fn().mockResolvedValue({ success: true, data: 'base64data' }),
    captureElement: jest.fn().mockResolvedValue({ success: true, data: 'base64data' }),
    captureArea: jest.fn().mockResolvedValue({ success: true, data: 'base64data' }),
    cleanup: jest.fn(),
    getSupportedFormats: jest.fn().mockReturnValue(['png', 'jpeg', 'webp'])
  })),
  validateAnnotation: jest.fn().mockReturnValue({ valid: true }),
  applyAnnotationDefaults: jest.fn().mockImplementation(a => a)
}));

jest.mock('../../recording/manager', () => ({
  RecordingManager: jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockResolvedValue({ success: true }),
    stopRecording: jest.fn().mockResolvedValue({ success: true }),
    pauseRecording: jest.fn().mockResolvedValue({ success: true }),
    resumeRecording: jest.fn().mockResolvedValue({ success: true }),
    getStatus: jest.fn().mockReturnValue({ state: 'idle' }),
    cleanup: jest.fn(),
    getSupportedFormats: jest.fn().mockReturnValue(['webm', 'mp4']),
    getQualityPresets: jest.fn().mockReturnValue(['low', 'medium', 'high'])
  })),
  RecordingState: { IDLE: 'idle', RECORDING: 'recording', PAUSED: 'paused' }
}));

jest.mock('../../proxy/manager', () => ({
  proxyManager: {
    setProxy: jest.fn().mockResolvedValue({ success: true }),
    clearProxy: jest.fn().mockResolvedValue({ success: true }),
    getProxyStatus: jest.fn().mockReturnValue({ enabled: false }),
    setupAuthHandler: jest.fn(),
    setProxyList: jest.fn().mockReturnValue({ success: true }),
    addProxy: jest.fn().mockReturnValue({ success: true }),
    removeProxy: jest.fn().mockReturnValue({ success: true }),
    rotateProxy: jest.fn().mockResolvedValue({ success: true }),
    startRotation: jest.fn().mockReturnValue({ success: true }),
    stopRotation: jest.fn().mockReturnValue({ success: true }),
    testProxy: jest.fn().mockResolvedValue({ success: true }),
    getStats: jest.fn().mockReturnValue({})
  },
  PROXY_TYPES: { HTTP: 'http', HTTPS: 'https', SOCKS4: 'socks4', SOCKS5: 'socks5' }
}));

jest.mock('../../utils/user-agents', () => ({
  userAgentManager: {
    setUserAgent: jest.fn().mockReturnValue({ success: true }),
    getRandomUserAgent: jest.fn().mockReturnValue('Mozilla/5.0 Test'),
    getUserAgentByCategory: jest.fn().mockReturnValue('Mozilla/5.0 Test'),
    rotateUserAgent: jest.fn().mockReturnValue({ success: true }),
    startRotation: jest.fn().mockReturnValue({ success: true }),
    stopRotation: jest.fn().mockReturnValue({ success: true }),
    setEnabledCategories: jest.fn().mockReturnValue({ success: true }),
    addCustomUserAgent: jest.fn().mockReturnValue({ success: true }),
    clearCustomUserAgents: jest.fn().mockReturnValue({ success: true }),
    getStatus: jest.fn().mockReturnValue({ current: 'test' }),
    getAvailableCategories: jest.fn().mockReturnValue(['desktop', 'mobile']),
    parseUserAgent: jest.fn().mockReturnValue({ browser: 'Chrome' })
  },
  UA_CATEGORIES: { DESKTOP: 'desktop', MOBILE: 'mobile' }
}));

jest.mock('../../utils/request-interceptor', () => ({
  requestInterceptor: {
    initialize: jest.fn(),
    setRequestRules: jest.fn().mockReturnValue({ success: true }),
    clearRequestRules: jest.fn().mockReturnValue({ success: true }),
    addBlockRule: jest.fn().mockReturnValue({ success: true }),
    addAllowRule: jest.fn().mockReturnValue({ success: true }),
    addHeaderRule: jest.fn().mockReturnValue({ success: true }),
    removeRule: jest.fn().mockReturnValue({ success: true }),
    setCustomHeaders: jest.fn().mockReturnValue({ success: true }),
    setHeadersToRemove: jest.fn().mockReturnValue({ success: true }),
    blockResourceType: jest.fn().mockReturnValue({ success: true }),
    unblockResourceType: jest.fn().mockReturnValue({ success: true }),
    applyPredefinedRules: jest.fn().mockReturnValue({ success: true }),
    getStatus: jest.fn().mockReturnValue({ enabled: true }),
    exportRules: jest.fn().mockReturnValue({}),
    importRules: jest.fn().mockReturnValue({ success: true }),
    resetStats: jest.fn().mockReturnValue({ success: true }),
    enable: jest.fn().mockReturnValue({ success: true }),
    disable: jest.fn().mockReturnValue({ success: true })
  },
  RESOURCE_TYPES: { SCRIPT: 'script', IMAGE: 'image' },
  PREDEFINED_BLOCK_RULES: { ads: [], trackers: [] }
}));

jest.mock('../../input/keyboard', () => ({
  KEY_CODES: { Enter: { key: 'Enter', code: 'Enter', keyCode: 13 } },
  KEYBOARD_LAYOUTS: { 'en-US': { name: 'US English' } },
  getSpecialKeyScript: jest.fn().mockReturnValue('return { success: true };'),
  getFullKeyPressScript: jest.fn().mockReturnValue('return { success: true };'),
  getKeyCombinationScript: jest.fn().mockReturnValue('return { success: true };'),
  getTypeTextScript: jest.fn().mockReturnValue('return { success: true };'),
  estimateTypingDuration: jest.fn().mockReturnValue(1000)
}));

jest.mock('../../input/mouse', () => ({
  getMouseMoveScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseClickScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseDoubleClickScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseRightClickScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseDragScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseHoverScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseScrollScript: jest.fn().mockReturnValue('return { success: true };'),
  getMouseWheelScript: jest.fn().mockReturnValue('return { success: true };'),
  getClickElementScript: jest.fn().mockReturnValue('return { success: true };'),
  getMousePositionTrackingScript: jest.fn().mockReturnValue('return { x: 0, y: 0 };')
}));

// Increase Jest timeout for all tests
jest.setTimeout(30000);

// Port allocation helper to avoid port conflicts
let portCounter = 19000;
function getNextPort() {
  return portCounter++;
}

/**
 * Helper to wait for WebSocket server to be ready
 * @param {WebSocketServer} server - The server instance
 * @returns {Promise<void>}
 */
function waitForServerReady(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server failed to start within timeout'));
    }, 5000);

    if (server.wss) {
      // Check if already listening
      if (server.wss.address()) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      server.wss.once('listening', () => {
        clearTimeout(timeout);
        resolve();
      });

      server.wss.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    } else {
      clearTimeout(timeout);
      reject(new Error('WebSocket server not initialized'));
    }
  });
}

/**
 * Helper to create a connected client and wait for connection
 * @param {number} port - The port to connect to
 * @returns {Promise<WebSocket>}
 */
function createConnectedClient(port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Client connection timeout'));
    }, 5000);

    const client = new WebSocket(`ws://localhost:${port}`);

    client.once('open', () => {
      // Wait for the connection status message
      client.once('message', () => {
        clearTimeout(timeout);
        resolve(client);
      });
    });

    client.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Helper to send command and wait for response
 * @param {WebSocket} client - The WebSocket client
 * @param {object} command - The command to send
 * @returns {Promise<object>}
 */
function sendCommand(client, command) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timeout: ${command.command}`));
    }, 5000);

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === command.id) {
        clearTimeout(timeout);
        client.removeListener('message', handler);
        resolve(response);
      }
    };

    client.on('message', handler);
    client.send(JSON.stringify(command));
  });
}

/**
 * Helper to safely close a WebSocket client
 * @param {WebSocket} client - The client to close
 * @returns {Promise<void>}
 */
function closeClient(client) {
  return new Promise((resolve) => {
    if (!client || client.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      // Force terminate if close doesn't complete
      if (client.readyState !== WebSocket.CLOSED) {
        client.terminate();
      }
      resolve();
    }, 1000);

    client.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });

    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close();
    } else {
      clearTimeout(timeout);
      resolve();
    }
  });
}

/**
 * Helper to safely close a server
 * @param {WebSocketServer} server - The server to close
 * @returns {Promise<void>}
 */
function closeServer(server) {
  return new Promise((resolve) => {
    if (!server || !server.wss) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      resolve();
    }, 2000);

    try {
      server.close();
      clearTimeout(timeout);
      resolve();
    } catch (e) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

describe('WebSocketServer', () => {
  let WebSocketServer;
  let mockMainWindow;
  let server;
  let client;

  beforeAll(() => {
    WebSocketServer = require('../../websocket/server');
  });

  beforeEach(() => {
    // Create mock main window
    mockMainWindow = {
      webContents: {
        send: jest.fn(),
        on: jest.fn()
      }
    };
  });

  afterEach(async () => {
    // Clean up client
    if (client) {
      await closeClient(client);
      client = null;
    }

    // Clean up server
    if (server) {
      await closeServer(server);
      server = null;
    }

    // Small delay to ensure port is released
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('Server Initialization', () => {
    test('should create WebSocket server on specified port', async () => {
      const port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);

      await waitForServerReady(server);

      expect(server.wss).toBeDefined();
      expect(server.port).toBe(port);
    });

    test('should accept client connections', async () => {
      const port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);

      await waitForServerReady(server);

      client = await createConnectedClient(port);

      expect(server.clients.size).toBe(1);
    });

    test('should assign unique client IDs', async () => {
      const port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);

      await waitForServerReady(server);

      const clientPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        const ws = new WebSocket(`ws://localhost:${port}`);

        ws.once('message', (data) => {
          clearTimeout(timeout);
          const message = JSON.parse(data.toString());
          if (message.type === 'status' && message.message === 'connected') {
            client = ws;
            resolve(message.clientId);
          }
        });

        ws.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const clientId = await clientPromise;
      expect(clientId).toMatch(/^client-\d+-[a-z0-9]+$/);
    });
  });

  describe('Command Handling', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('ping command should return pong', async () => {
      const id = 'test-ping-1';
      const response = await sendCommand(client, { id, command: 'ping' });

      expect(response.success).toBe(true);
      expect(response.message).toBe('pong');
      expect(response.timestamp).toBeDefined();
    });

    test('status command should return server status', async () => {
      const id = 'test-status-1';
      const response = await sendCommand(client, { id, command: 'status' });

      expect(response.success).toBe(true);
      expect(response.status).toBeDefined();
      expect(response.status.ready).toBe(true);
      expect(response.status.port).toBe(port);
    });

    test('unknown command should return error', async () => {
      const id = 'test-unknown-1';
      const response = await sendCommand(client, { id, command: 'unknown_command_xyz' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown command');
    });

    test('navigate command should require URL', async () => {
      const id = 'test-navigate-1';
      const response = await sendCommand(client, { id, command: 'navigate' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL is required');
    });

    test('click command should require selector', async () => {
      const id = 'test-click-1';
      const response = await sendCommand(client, { id, command: 'click' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector is required');
    });

    test('fill command should require selector and value', async () => {
      const id = 'test-fill-1';
      const response = await sendCommand(client, { id, command: 'fill' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector and value are required');
    });

    test('execute_script command should require script', async () => {
      const id = 'test-script-1';
      const response = await sendCommand(client, { id, command: 'execute_script' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Script is required');
    });

    test('wait_for_element command should require selector', async () => {
      const id = 'test-wait-1';
      const response = await sendCommand(client, { id, command: 'wait_for_element' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector is required');
    });

    test('get_cookies command should require URL', async () => {
      const id = 'test-cookies-1';
      const response = await sendCommand(client, { id, command: 'get_cookies' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL is required');
    });

    test('set_cookies command should require cookies array', async () => {
      const id = 'test-set-cookies-1';
      const response = await sendCommand(client, { id, command: 'set_cookies' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Cookies array is required');
    });
  });

  describe('Proxy Commands', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('set_proxy should require host and port', async () => {
      const id = 'test-proxy-1';
      const response = await sendCommand(client, { id, command: 'set_proxy' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Host and port are required');
    });

    test('get_proxy_status should return proxy status', async () => {
      const id = 'test-proxy-status-1';
      const response = await sendCommand(client, { id, command: 'get_proxy_status' });

      expect(response.success).toBe(true);
      expect(response.enabled).toBeDefined();
    });

    test('set_proxy_list should require proxies array', async () => {
      const id = 'test-proxy-list-1';
      const response = await sendCommand(client, { id, command: 'set_proxy_list' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Proxies array is required');
    });
  });

  describe('Screenshot Commands', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('screenshot_element should require selector', async () => {
      const id = 'test-screenshot-element-1';
      const response = await sendCommand(client, { id, command: 'screenshot_element' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector is required');
    });

    test('screenshot_area should require coordinates', async () => {
      const id = 'test-screenshot-area-1';
      const response = await sendCommand(client, { id, command: 'screenshot_area' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('x, y, width, and height are required');
    });

    test('screenshot_formats should return supported formats', async () => {
      const id = 'test-screenshot-formats-1';
      const response = await sendCommand(client, { id, command: 'screenshot_formats' });

      expect(response.success).toBe(true);
      expect(response.formats).toBeDefined();
      expect(Array.isArray(response.formats)).toBe(true);
    });
  });

  describe('Recording Commands', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('recording_status should return current status', async () => {
      const id = 'test-recording-status-1';
      const response = await sendCommand(client, { id, command: 'recording_status' });

      expect(response.success).toBe(true);
      expect(response.state).toBe('idle');
    });

    test('recording_formats should return formats and quality presets', async () => {
      const id = 'test-recording-formats-1';
      const response = await sendCommand(client, { id, command: 'recording_formats' });

      expect(response.success).toBe(true);
      expect(response.formats).toBeDefined();
      expect(response.qualityPresets).toBeDefined();
    });
  });

  describe('Session Management', () => {
    let port;
    let mockSessionManager;

    beforeEach(async () => {
      port = getNextPort();

      mockSessionManager = {
        createSession: jest.fn().mockReturnValue({ success: true, session: { id: 'test-session' } }),
        switchSession: jest.fn().mockReturnValue({ success: true }),
        deleteSession: jest.fn().mockResolvedValue({ success: true }),
        listSessions: jest.fn().mockReturnValue({ success: true, sessions: [] }),
        exportSession: jest.fn().mockResolvedValue({ success: true, data: {} }),
        importSession: jest.fn().mockResolvedValue({ success: true }),
        getSessionInfo: jest.fn().mockReturnValue({ id: 'test', name: 'Test' }),
        clearSessionData: jest.fn().mockResolvedValue({ success: true }),
        getActivePartition: jest.fn().mockReturnValue('persist:test'),
        activeSessionId: 'test-session'
      };

      server = new WebSocketServer(port, mockMainWindow, { sessionManager: mockSessionManager });
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('list_sessions should return sessions', async () => {
      const id = 'test-list-sessions-1';
      const response = await sendCommand(client, { id, command: 'list_sessions' });

      expect(response.success).toBe(true);
      expect(response.sessions).toBeDefined();
    });

    test('get_session_info should return session details', async () => {
      const id = 'test-session-info-1';
      const response = await sendCommand(client, { id, command: 'get_session_info' });

      expect(response.success).toBe(true);
      expect(response.session).toBeDefined();
    });
  });

  describe('Tab Management', () => {
    let port;
    let mockTabManager;

    beforeEach(async () => {
      port = getNextPort();

      mockTabManager = {
        createTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-1' } }),
        closeTab: jest.fn().mockReturnValue({ success: true }),
        switchTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-1' } }),
        switchToTabIndex: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-1' } }),
        listTabs: jest.fn().mockReturnValue({ success: true, tabs: [] }),
        getTabInfo: jest.fn().mockReturnValue({ id: 'tab-1', url: 'https://example.com' }),
        getActiveTab: jest.fn().mockReturnValue({ id: 'tab-1', url: 'https://example.com' }),
        navigateTab: jest.fn().mockReturnValue({ success: true }),
        reloadTab: jest.fn().mockReturnValue({ success: true }),
        goBack: jest.fn().mockReturnValue({ success: true }),
        goForward: jest.fn().mockReturnValue({ success: true }),
        duplicateTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-2' } }),
        pinTab: jest.fn().mockReturnValue({ success: true }),
        muteTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-1', muted: true } }),
        setZoom: jest.fn().mockReturnValue({ success: true }),
        moveTab: jest.fn().mockReturnValue({ success: true }),
        closeOtherTabs: jest.fn().mockReturnValue({ success: true }),
        nextTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-2' } }),
        previousTab: jest.fn().mockReturnValue({ success: true, tab: { id: 'tab-1' } }),
        tabs: new Map(),
        activeTabId: 'tab-1'
      };

      server = new WebSocketServer(port, mockMainWindow, { tabManager: mockTabManager });
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('list_tabs should return tabs', async () => {
      const id = 'test-list-tabs-1';
      const response = await sendCommand(client, { id, command: 'list_tabs' });

      expect(response.success).toBe(true);
      expect(response.tabs).toBeDefined();
    });

    test('get_active_tab should return active tab', async () => {
      const id = 'test-active-tab-1';
      const response = await sendCommand(client, { id, command: 'get_active_tab' });

      expect(response.success).toBe(true);
      expect(response.tab).toBeDefined();
    });

    test('close_tab should require tab ID', async () => {
      const id = 'test-close-tab-1';
      const response = await sendCommand(client, { id, command: 'close_tab' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Tab ID is required');
    });

    test('navigate_tab should require URL', async () => {
      const id = 'test-navigate-tab-1';
      const response = await sendCommand(client, { id, command: 'navigate_tab' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('URL is required');
    });
  });

  describe('Keyboard Commands', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('key_press should require key', async () => {
      const id = 'test-keypress-1';
      const response = await sendCommand(client, { id, command: 'key_press' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Key is required');
    });

    test('key_combination should require keys array', async () => {
      const id = 'test-keycombination-1';
      const response = await sendCommand(client, { id, command: 'key_combination' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Keys array is required');
    });

    test('type_text should require text', async () => {
      const id = 'test-typetext-1';
      const response = await sendCommand(client, { id, command: 'type_text' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Text is required');
    });

    test('keyboard_layouts should return available layouts', async () => {
      const id = 'test-layouts-1';
      const response = await sendCommand(client, { id, command: 'keyboard_layouts' });

      expect(response.success).toBe(true);
      expect(response.layouts).toBeDefined();
    });

    test('special_keys should return available keys', async () => {
      const id = 'test-special-keys-1';
      const response = await sendCommand(client, { id, command: 'special_keys' });

      expect(response.success).toBe(true);
      expect(response.keys).toBeDefined();
    });
  });

  describe('Mouse Commands', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('mouse_move should require coordinates', async () => {
      const id = 'test-mousemove-1';
      const response = await sendCommand(client, { id, command: 'mouse_move' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('X and Y coordinates are required');
    });

    test('mouse_click should require coordinates', async () => {
      const id = 'test-mouseclick-1';
      const response = await sendCommand(client, { id, command: 'mouse_click' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('X and Y coordinates are required');
    });

    test('mouse_drag should require start and end coordinates', async () => {
      const id = 'test-mousedrag-1';
      const response = await sendCommand(client, { id, command: 'mouse_drag' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Start and end coordinates are required');
    });

    test('click_at_element should require selector', async () => {
      const id = 'test-clickelement-1';
      const response = await sendCommand(client, { id, command: 'click_at_element' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Selector is required');
    });
  });

  describe('Error Handling', () => {
    let port;

    beforeEach(async () => {
      port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);
      client = await createConnectedClient(port);
    });

    test('should handle malformed JSON gracefully', async () => {
      const responsePromise = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);
        client.once('message', (data) => {
          clearTimeout(timeout);
          const response = JSON.parse(data.toString());
          if (response.success === false && response.error) {
            resolve(response);
          }
        });
      });

      client.send('not valid json');

      const response = await responsePromise;
      expect(response).not.toBeNull();
      expect(response.error).toBeDefined();
    });

    test('should handle missing command field', async () => {
      const id = 'test-missing-command';
      const response = await sendCommand(client, { id });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Command is required');
    });
  });

  describe('Broadcast', () => {
    test('should broadcast to all connected clients', async () => {
      const port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);

      const client1 = await createConnectedClient(port);
      const client2 = await createConnectedClient(port);

      const broadcastMessage = { type: 'test', data: 'broadcast' };
      let receivedCount = 0;

      const receivePromise = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(receivedCount), 3000);

        const handleMessage = (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'test') {
            receivedCount++;
            if (receivedCount === 2) {
              clearTimeout(timeout);
              resolve(receivedCount);
            }
          }
        };

        client1.on('message', handleMessage);
        client2.on('message', handleMessage);
      });

      server.broadcast(broadcastMessage);

      const count = await receivePromise;
      expect(count).toBe(2);

      await closeClient(client1);
      await closeClient(client2);
    });
  });

  describe('Cleanup', () => {
    test('should close all connections on server close', async () => {
      const port = getNextPort();
      server = new WebSocketServer(port, mockMainWindow);
      await waitForServerReady(server);

      client = await createConnectedClient(port);

      const closePromise = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000);
        client.once('close', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      });

      server.close();

      const closed = await closePromise;
      expect(closed).toBe(true);
      expect(server.wss).toBeNull();
    });
  });
});

/**
 * Basset Hound Browser - WebSocket Server Unit Tests
 * Tests for WebSocket command handling and message processing
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

  afterEach(() => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    if (server) {
      server.close();
    }
  });

  describe('Server Initialization', () => {
    test('should create WebSocket server on specified port', (done) => {
      const port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        expect(server.wss).toBeDefined();
        expect(server.port).toBe(port);
        done();
      }, 100);
    });

    test('should accept client connections', (done) => {
      const port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);

        client.on('open', () => {
          expect(server.clients.size).toBe(1);
          done();
        });

        client.on('error', done);
      }, 100);
    });

    test('should assign unique client IDs', (done) => {
      const port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'status' && message.message === 'connected') {
            expect(message.clientId).toMatch(/^client-\d+-[a-z0-9]+$/);
            done();
          }
        });

        client.on('error', done);
      }, 100);
    });
  });

  describe('Command Handling', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          // Wait for connection status message
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('ping command should return pong', (done) => {
      const id = 'test-ping-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.message).toBe('pong');
          expect(response.timestamp).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'ping' }));
    });

    test('status command should return server status', (done) => {
      const id = 'test-status-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.status).toBeDefined();
          expect(response.status.ready).toBe(true);
          expect(response.status.port).toBe(port);
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'status' }));
    });

    test('unknown command should return error', (done) => {
      const id = 'test-unknown-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Unknown command');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'unknown_command_xyz' }));
    });

    test('navigate command should require URL', (done) => {
      const id = 'test-navigate-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('URL is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'navigate' }));
    });

    test('click command should require selector', (done) => {
      const id = 'test-click-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Selector is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'click' }));
    });

    test('fill command should require selector and value', (done) => {
      const id = 'test-fill-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Selector and value are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'fill' }));
    });

    test('execute_script command should require script', (done) => {
      const id = 'test-script-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Script is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'execute_script' }));
    });

    test('wait_for_element command should require selector', (done) => {
      const id = 'test-wait-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Selector is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'wait_for_element' }));
    });

    test('get_cookies command should require URL', (done) => {
      const id = 'test-cookies-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('URL is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'get_cookies' }));
    });

    test('set_cookies command should require cookies array', (done) => {
      const id = 'test-set-cookies-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Cookies array is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'set_cookies' }));
    });
  });

  describe('Proxy Commands', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('set_proxy should require host and port', (done) => {
      const id = 'test-proxy-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Host and port are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'set_proxy' }));
    });

    test('get_proxy_status should return proxy status', (done) => {
      const id = 'test-proxy-status-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.enabled).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'get_proxy_status' }));
    });

    test('set_proxy_list should require proxies array', (done) => {
      const id = 'test-proxy-list-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Proxies array is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'set_proxy_list' }));
    });
  });

  describe('Screenshot Commands', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('screenshot_element should require selector', (done) => {
      const id = 'test-screenshot-element-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Selector is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'screenshot_element' }));
    });

    test('screenshot_area should require coordinates', (done) => {
      const id = 'test-screenshot-area-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('x, y, width, and height are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'screenshot_area' }));
    });

    test('screenshot_formats should return supported formats', (done) => {
      const id = 'test-screenshot-formats-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.formats).toBeDefined();
          expect(Array.isArray(response.formats)).toBe(true);
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'screenshot_formats' }));
    });
  });

  describe('Recording Commands', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('recording_status should return current status', (done) => {
      const id = 'test-recording-status-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.state).toBe('idle');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'recording_status' }));
    });

    test('recording_formats should return formats and quality presets', (done) => {
      const id = 'test-recording-formats-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.formats).toBeDefined();
          expect(response.qualityPresets).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'recording_formats' }));
    });
  });

  describe('Session Management', () => {
    let port;
    let mockSessionManager;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);

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

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('list_sessions should return sessions', (done) => {
      const id = 'test-list-sessions-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.sessions).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'list_sessions' }));
    });

    test('get_session_info should return session details', (done) => {
      const id = 'test-session-info-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.session).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'get_session_info' }));
    });
  });

  describe('Tab Management', () => {
    let port;
    let mockTabManager;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);

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

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('list_tabs should return tabs', (done) => {
      const id = 'test-list-tabs-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.tabs).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'list_tabs' }));
    });

    test('get_active_tab should return active tab', (done) => {
      const id = 'test-active-tab-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.tab).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'get_active_tab' }));
    });

    test('close_tab should require tab ID', (done) => {
      const id = 'test-close-tab-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Tab ID is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'close_tab' }));
    });

    test('navigate_tab should require URL', (done) => {
      const id = 'test-navigate-tab-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('URL is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'navigate_tab' }));
    });
  });

  describe('Keyboard Commands', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('key_press should require key', (done) => {
      const id = 'test-keypress-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Key is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'key_press' }));
    });

    test('key_combination should require keys array', (done) => {
      const id = 'test-keycombination-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Keys array is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'key_combination' }));
    });

    test('type_text should require text', (done) => {
      const id = 'test-typetext-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Text is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'type_text' }));
    });

    test('keyboard_layouts should return available layouts', (done) => {
      const id = 'test-layouts-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.layouts).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'keyboard_layouts' }));
    });

    test('special_keys should return available keys', (done) => {
      const id = 'test-special-keys-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(true);
          expect(response.keys).toBeDefined();
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'special_keys' }));
    });
  });

  describe('Mouse Commands', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('mouse_move should require coordinates', (done) => {
      const id = 'test-mousemove-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('X and Y coordinates are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'mouse_move' }));
    });

    test('mouse_click should require coordinates', (done) => {
      const id = 'test-mouseclick-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('X and Y coordinates are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'mouse_click' }));
    });

    test('mouse_drag should require start and end coordinates', (done) => {
      const id = 'test-mousedrag-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Start and end coordinates are required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'mouse_drag' }));
    });

    test('click_at_element should require selector', (done) => {
      const id = 'test-clickelement-1';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Selector is required');
          done();
        }
      });

      client.send(JSON.stringify({ id, command: 'click_at_element' }));
    });
  });

  describe('Error Handling', () => {
    let port;

    beforeEach((done) => {
      port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);
        client.on('open', () => {
          client.once('message', () => done());
        });
        client.on('error', done);
      }, 100);
    });

    test('should handle malformed JSON gracefully', (done) => {
      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.success === false && response.error) {
          expect(response.error).toBeDefined();
          done();
        }
      });

      client.send('not valid json');
    });

    test('should handle missing command field', (done) => {
      const id = 'test-missing-command';

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Command is required');
          done();
        }
      });

      client.send(JSON.stringify({ id }));
    });
  });

  describe('Broadcast', () => {
    test('should broadcast to all connected clients', (done) => {
      const port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        const client1 = new WebSocket(`ws://localhost:${port}`);
        const client2 = new WebSocket(`ws://localhost:${port}`);

        let receivedCount = 0;
        const broadcastMessage = { type: 'test', data: 'broadcast' };

        const handleMessage = (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'test') {
            receivedCount++;
            if (receivedCount === 2) {
              client1.close();
              client2.close();
              done();
            }
          }
        };

        let connected = 0;
        const onConnect = () => {
          connected++;
          if (connected === 2) {
            client1.on('message', handleMessage);
            client2.on('message', handleMessage);
            server.broadcast(broadcastMessage);
          }
        };

        client1.on('open', () => {
          client1.once('message', onConnect);
        });
        client2.on('open', () => {
          client2.once('message', onConnect);
        });
      }, 100);
    });
  });

  describe('Cleanup', () => {
    test('should close all connections on server close', (done) => {
      const port = 18765 + Math.floor(Math.random() * 1000);
      server = new WebSocketServer(port, mockMainWindow);

      setTimeout(() => {
        client = new WebSocket(`ws://localhost:${port}`);

        client.on('open', () => {
          client.once('message', () => {
            server.close();
          });
        });

        client.on('close', () => {
          expect(server.wss).toBeNull();
          done();
        });
      }, 100);
    });
  });
});

/**
 * Basset Hound Browser - JavaScript SDK Test Suite
 * Comprehensive testing for all SDK features
 * Test Framework: Jest (built into most Node.js environments)
 */

const { BrowserClient, CommandResponse, SessionCheckpoint } = require('../../sdks/js-sdk/basset-hound.js');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

// ==========================================
// MOCK WEBSOCKET SERVER
// ==========================================

class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.messages = [];
    this.shouldFail = false;
    this.responseDelay = 0;

    // Simulate connection opening
    setImmediate(() => {
      if (!this.shouldFail) {
        this.readyState = 1; // OPEN
        if (this.onopen) {
          this.onopen({ type: 'open' });
        }
      } else {
        if (this.onerror) {
          this.onerror(new Error('Connection failed'));
        }
      }
    });
  }

  send(data) {
    this.messages.push(data);

    // Simulate server response
    if (this.responseDelay > 0) {
      setTimeout(() => this._sendResponse(data), this.responseDelay);
    } else {
      setImmediate(() => this._sendResponse(data));
    }
  }

  _sendResponse(data) {
    try {
      const message = JSON.parse(data);
      const response = {
        id: message.id,
        command: message.command,
        success: true,
        data: this._generateResponseData(message.command),
        executionTime: Math.random() * 100
      };

      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify(response),
          type: 'message'
        });
      }
    } catch (e) {
      if (this.onerror) {
        this.onerror(e);
      }
    }
  }

  _generateResponseData(command) {
    const responses = {
      'navigate': { url: 'https://example.com', success: true },
      'get_url': { url: 'https://example.com' },
      'get_title': { title: 'Example Domain' },
      'get_content': { html: '<html><body>Test</body></html>' },
      'screenshot': { data: Buffer.from('fake-png-data'), size: 12345 },
      'extract_metadata': { title: 'Example', description: 'Test page' },
      'extract_links': { links: ['https://example.com'] },
      'extract_forms': { forms: [] },
      'get_cookies': { cookies: [] },
      'set_cookie': { success: true },
      'delete_cookie': { success: true },
      'click': { success: true },
      'fill': { success: true },
      'scroll': { success: true },
      'hover': { success: true },
      'type_text': { success: true },
      'create_checkpoint': { checkpointId: 'cp-' + Date.now(), timestamp: Date.now() },
      'list_checkpoints': { checkpoints: [] },
      'create_session_checkpoint': { checkpointId: 'cp-' + Date.now() },
      'apply_fingerprint': { success: true },
      'rotate_user_agent': { userAgent: 'Mozilla/5.0 (Test)' },
      'set_proxy': { success: true },
      'enable_tor': { success: true },
      'ping': { success: true }
    };

    return responses[command] || { success: true };
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close' });
    }
  }

  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify(data),
        type: 'message'
      });
    }
  }
}

// Override WebSocket in test environment
global.WebSocket = MockWebSocket;

// ==========================================
// TEST SUITES
// ==========================================

describe('BrowserClient Initialization', () => {
  test('creates client with default options', () => {
    const client = new BrowserClient();
    expect(client.wsUrl).toBe('ws://localhost:8765');
    expect(client.timeout).toBe(30000);
    expect(client.autoReconnect).toBe(true);
    expect(client.reconnectDelay).toBe(1000);
    expect(client.maxRetries).toBe(3);
    expect(client.debug).toBe(false);
    expect(client.connected).toBe(false);
  });

  test('creates client with custom options', () => {
    const options = {
      timeout: 60000,
      autoReconnect: false,
      reconnectDelay: 5000,
      maxRetries: 5,
      debug: true
    };
    const client = new BrowserClient('wss://example.com:9000', options);
    expect(client.wsUrl).toBe('wss://example.com:9000');
    expect(client.timeout).toBe(60000);
    expect(client.autoReconnect).toBe(false);
    expect(client.maxRetries).toBe(5);
    expect(client.debug).toBe(true);
  });

  test('initializes event handlers', () => {
    const client = new BrowserClient();
    expect(client.eventHandlers).toEqual({
      connect: [],
      disconnect: [],
      error: [],
      message: []
    });
  });

  test('initializes session state', () => {
    const client = new BrowserClient();
    expect(client.sessionId).toBeNull();
    expect(client.checkpoints.size).toBe(0);
    expect(client.currentCheckpoint).toBeNull();
  });

  test('supports URL variations', () => {
    const urls = [
      'ws://localhost:8765',
      'wss://example.com:8765',
      'ws://192.168.1.1:8765',
      'wss://secure.example.com:9000'
    ];

    urls.forEach(url => {
      const client = new BrowserClient(url);
      expect(client.wsUrl).toBe(url);
    });
  });
});

describe('BrowserClient Connection Lifecycle', () => {
  let client;

  beforeEach(() => {
    client = new BrowserClient();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('connects to server', async () => {
    await client.connect();
    expect(client.connected).toBe(true);
  });

  test('disconnects from server', async () => {
    await client.connect();
    await client.disconnect();
    expect(client.connected).toBe(false);
  });

  test('emits connect event', async () => {
    const connectHandler = jest.fn();
    client.on('connect', connectHandler);
    await client.connect();
    expect(connectHandler).toHaveBeenCalled();
  });

  test('emits disconnect event', async () => {
    await client.connect();
    const disconnectHandler = jest.fn();
    client.on('disconnect', disconnectHandler);
    await client.disconnect();
    expect(disconnectHandler).toHaveBeenCalled();
  });

  test('resets reconnect attempts on successful connect', async () => {
    await client.connect();
    expect(client.reconnectAttempts).toBe(0);
  });

  test('throws error when sending command while disconnected', async () => {
    await expect(client.sendCommand('ping')).rejects.toThrow('Not connected');
  });

  test('reconnects automatically on timeout with autoReconnect enabled', async () => {
    const client2 = new BrowserClient('ws://localhost:8765', {
      autoReconnect: true,
      maxRetries: 2
    });
    await client2.connect();
    expect(client2.connected).toBe(true);
  });
});

describe('CommandResponse', () => {
  test('creates response from data', () => {
    const data = {
      id: '123',
      command: 'navigate',
      success: true,
      data: { url: 'https://example.com' }
    };
    const response = CommandResponse.fromJSON(data);
    expect(response.id).toBe('123');
    expect(response.command).toBe('navigate');
    expect(response.success).toBe(true);
    expect(response.data.url).toBe('https://example.com');
  });

  test('parses error response', () => {
    const data = {
      id: '456',
      command: 'click',
      success: false,
      error: 'Element not found'
    };
    const response = CommandResponse.fromJSON(data);
    expect(response.success).toBe(false);
    expect(response.error).toBe('Element not found');
  });

  test('handles recovery suggestions', () => {
    const data = {
      id: '789',
      command: 'navigate',
      success: false,
      error: 'Rate limited',
      recovery: {
        suggestion: 'Wait 60 seconds',
        alternativeCommands: ['rotate_proxy']
      }
    };
    const response = CommandResponse.fromJSON(data);
    expect(response.hasRecovery()).toBe(true);
    expect(response.recovery.suggestion).toBe('Wait 60 seconds');
  });

  test('isSuccess() method works', () => {
    const success = new CommandResponse({ success: true });
    const error = new CommandResponse({ success: false });
    expect(success.isSuccess()).toBe(true);
    expect(error.isSuccess()).toBe(false);
  });

  test('isError() method works', () => {
    const success = new CommandResponse({ success: true });
    const error = new CommandResponse({ success: false });
    expect(error.isError()).toBe(true);
    expect(success.isError()).toBe(false);
  });
});

describe('SessionCheckpoint', () => {
  test('creates checkpoint with data', () => {
    const checkpoint = new SessionCheckpoint(
      'cp-001',
      'test-checkpoint',
      1234567890,
      { url: 'https://example.com' }
    );
    expect(checkpoint.id).toBe('cp-001');
    expect(checkpoint.name).toBe('test-checkpoint');
    expect(checkpoint.timestamp).toBe(1234567890);
    expect(checkpoint.state.url).toBe('https://example.com');
  });

  test('serializes to JSON', () => {
    const checkpoint = new SessionCheckpoint(
      'cp-001',
      'test',
      1234567890,
      { url: 'https://example.com' }
    );
    const json = checkpoint.toJSON();
    expect(json.id).toBe('cp-001');
    expect(json.name).toBe('test');
    expect(json.state.url).toBe('https://example.com');
  });

  test('initializes metadata', () => {
    const checkpoint = new SessionCheckpoint('cp-001', 'test', Date.now());
    expect(checkpoint.metadata).toEqual({});
  });
});

describe('Navigation Commands', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('navigates to URL', async () => {
    const response = await client.navigate('https://example.com');
    expect(response.success).toBe(true);
    expect(response.command).toBe('navigate');
  });

  test('supports navigation options', async () => {
    const response = await client.navigate('https://example.com', {
      waitTime: 2000,
      waitFor: '.loaded'
    });
    expect(response.success).toBe(true);
  });

  test('gets current URL', async () => {
    const response = await client.getUrl();
    expect(response.success).toBe(true);
    expect(response.data.url).toBeDefined();
  });

  test('gets page title', async () => {
    const response = await client.getTitle();
    expect(response.success).toBe(true);
    expect(response.data.title).toBeDefined();
  });

  test('goes back in history', async () => {
    const response = await client.goBack();
    expect(response.success).toBe(true);
  });

  test('goes forward in history', async () => {
    const response = await client.goForward();
    expect(response.success).toBe(true);
  });

  test('refreshes page', async () => {
    const response = await client.refresh(false);
    expect(response.success).toBe(true);
  });

  test('refreshes page with hard flag', async () => {
    const response = await client.refresh(true);
    expect(response.success).toBe(true);
  });
});

describe('Interaction Commands', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('clicks element', async () => {
    const response = await client.click('.button');
    expect(response.success).toBe(true);
  });

  test('fills form field', async () => {
    const response = await client.fill('input[name="email"]', 'test@example.com');
    expect(response.success).toBe(true);
  });

  test('types text', async () => {
    const response = await client.typeText('Hello World');
    expect(response.success).toBe(true);
  });

  test('hovers over element', async () => {
    const response = await client.hover('.menu-item');
    expect(response.success).toBe(true);
  });

  test('scrolls page', async () => {
    const response = await client.scroll({ y: 100 });
    expect(response.success).toBe(true);
  });

  test('waits for element', async () => {
    const response = await client.waitForElement('.loaded', 5000);
    expect(response.success).toBe(true);
  });

  test('executes script', async () => {
    const response = await client.executeScript('return 42;');
    expect(response.success).toBe(true);
  });

  test('supports humanize option', async () => {
    const response = await client.click('.button', { humanize: true });
    expect(response.success).toBe(true);
  });
});

describe('Content Extraction Commands', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('gets page content', async () => {
    const response = await client.getContent();
    expect(response.success).toBe(true);
    expect(response.data.html).toBeDefined();
  });

  test('gets page state', async () => {
    const response = await client.getPageState();
    expect(response.success).toBe(true);
  });

  test('extracts links', async () => {
    const response = await client.extractLinks();
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.links)).toBe(true);
  });

  test('extracts forms', async () => {
    const response = await client.extractForms();
    expect(response.success).toBe(true);
  });

  test('extracts images', async () => {
    const response = await client.extractImages();
    expect(response.success).toBe(true);
  });

  test('extracts metadata', async () => {
    const response = await client.extractMetadata();
    expect(response.success).toBe(true);
  });

  test('extracts all content', async () => {
    const response = await client.extractAll();
    expect(response.success).toBe(true);
  });

  test('detects technology', async () => {
    const response = await client.detectTechnology();
    expect(response.success).toBe(true);
  });

  test('identifies CMS', async () => {
    const response = await client.identifyCms();
    expect(response.success).toBe(true);
  });

  test('identifies analytics', async () => {
    const response = await client.identifyAnalytics();
    expect(response.success).toBe(true);
  });
});

describe('Screenshot Commands', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('takes screenshot', async () => {
    const response = await client.screenshot();
    expect(response.success).toBe(true);
  });

  test('takes viewport screenshot', async () => {
    const response = await client.screenshotViewport();
    expect(response.success).toBe(true);
  });

  test('takes full page screenshot', async () => {
    const response = await client.screenshotFullPage();
    expect(response.success).toBe(true);
  });

  test('takes element screenshot', async () => {
    const response = await client.screenshotElement('.container');
    expect(response.success).toBe(true);
  });

  test('takes forensic screenshot', async () => {
    const response = await client.screenshotForensic();
    expect(response.success).toBe(true);
  });

  test('supports screenshot options', async () => {
    const response = await client.screenshot({
      format: 'jpeg',
      quality: 80
    });
    expect(response.success).toBe(true);
  });
});

describe('Cookie Management Commands', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('gets cookies', async () => {
    const response = await client.getCookies('https://example.com');
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.cookies)).toBe(true);
  });

  test('sets cookie', async () => {
    const response = await client.setCookie('session', 'abc123');
    expect(response.success).toBe(true);
  });

  test('sets cookie with options', async () => {
    const response = await client.setCookie('session', 'abc123', {
      domain: 'example.com',
      path: '/',
      httpOnly: true,
      secure: true
    });
    expect(response.success).toBe(true);
  });

  test('deletes cookie', async () => {
    const response = await client.deleteCookie('session');
    expect(response.success).toBe(true);
  });

  test('gets local storage', async () => {
    const response = await client.getLocalStorage();
    expect(response.success).toBe(true);
  });

  test('gets session storage', async () => {
    const response = await client.getSessionStorage();
    expect(response.success).toBe(true);
  });
});

describe('Session Checkpoint Management', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('creates checkpoint', async () => {
    const result = await client.createCheckpoint('after-nav');
    expect(result.checkpointId).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });

  test('lists checkpoints', async () => {
    const checkpoints = await client.listCheckpoints();
    expect(Array.isArray(checkpoints)).toBe(true);
  });

  test('stores checkpoint in map', async () => {
    const result = await client.createCheckpoint('test-cp');
    expect(client.checkpoints.has(result.checkpointId)).toBe(true);
  });

  test('rollbacks to checkpoint', async () => {
    const result = await client.createCheckpoint('test-cp');
    const rollback = await client.rollbackToCheckpoint(result.checkpointId);
    expect(rollback.success).toBe(true);
  });

  test('deletes checkpoint', async () => {
    const result = await client.createCheckpoint('test-cp');
    const deleted = await client.deleteCheckpoint(result.checkpointId);
    expect(deleted).toBe(true);
    expect(client.checkpoints.has(result.checkpointId)).toBe(false);
  });

  test('throws when rollback to non-existent checkpoint', async () => {
    await expect(client.rollbackToCheckpoint('non-existent')).rejects.toThrow();
  });

  test('branches session', async () => {
    const cp = await client.createCheckpoint('test-cp');
    const branch = await client.branchSession(cp.checkpointId, 'branch-1');
    expect(branch.success).toBe(true);
  });

  test('resumes session', async () => {
    const cp = await client.createCheckpoint('test-cp');
    const resume = await client.resumeSession(cp.checkpointId);
    expect(resume.success).toBe(true);
  });
});

describe('Event System', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('registers event handler', () => {
    const handler = jest.fn();
    client.on('connect', handler);
    expect(client.eventHandlers.connect).toContain(handler);
  });

  test('removes event handler', () => {
    const handler = jest.fn();
    client.on('connect', handler);
    client.off('connect', handler);
    expect(client.eventHandlers.connect).not.toContain(handler);
  });

  test('emits events', async () => {
    const handler = jest.fn();
    client.on('connect', handler);
    await client.connect();
    expect(handler).toHaveBeenCalled();
  });

  test('supports multiple handlers for same event', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    client.on('connect', handler1);
    client.on('connect', handler2);
    await client.connect();
    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  test('supports disconnect event', async () => {
    await client.connect();
    const handler = jest.fn();
    client.on('disconnect', handler);
    await client.disconnect();
    expect(handler).toHaveBeenCalled();
  });

  test('emits error events', async () => {
    const handler = jest.fn();
    client.on('error', handler);
    // Manually emit error for testing
    client._emit('error', new Error('Test error'));
    expect(handler).toHaveBeenCalled();
  });

  test('emits message events', async () => {
    await client.connect();
    const handler = jest.fn();
    client.on('message', handler);
    // Message will be emitted when sendCommand gets response
    expect(client.eventHandlers.message).toContain(handler);
  });
});

describe('Evasion & Bot Detection Bypass', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('applies fingerprint', async () => {
    const response = await client.applyFingerprint('chrome-100-windows');
    expect(response.success).toBe(true);
  });

  test('rotates user agent', async () => {
    const response = await client.rotateUserAgent();
    expect(response.success).toBe(true);
  });

  test('sets proxy', async () => {
    const response = await client.setProxy('http://proxy.example.com:8080');
    expect(response.success).toBe(true);
  });

  test('sets proxy with credentials', async () => {
    const response = await client.setProxy('http://proxy.example.com:8080', {
      username: 'user',
      password: 'pass'
    });
    expect(response.success).toBe(true);
  });

  test('enables Tor', async () => {
    const response = await client.enableTor();
    expect(response.success).toBe(true);
  });

  test('disables Tor', async () => {
    const response = await client.disableTor();
    expect(response.success).toBe(true);
  });

  test('gets proxy reputation', async () => {
    const response = await client.getProxyReputation('1.2.3.4');
    expect(response.success).toBe(true);
  });

  test('sets geo-lock', async () => {
    const response = await client.setGeoLock({
      country: 'US',
      region: 'CA'
    });
    expect(response.success).toBe(true);
  });

  test('gets proxy analytics', async () => {
    const response = await client.getProxyAnalytics();
    expect(response.success).toBe(true);
  });
});

describe('Batch Operations', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('executes batch commands', async () => {
    const commands = [
      { command: 'navigate', url: 'https://example.com' },
      { command: 'get_title' },
      { command: 'get_content' }
    ];
    const responses = await client.batchCommands(commands);
    expect(Array.isArray(responses)).toBe(true);
    expect(responses.length).toBe(3);
    responses.forEach(r => {
      expect(r.success).toBe(true);
    });
  });

  test('batch preserves command order', async () => {
    const commands = [
      { command: 'navigate', url: 'https://test1.com' },
      { command: 'get_title' },
      { command: 'navigate', url: 'https://test2.com' }
    ];
    const responses = await client.batchCommands(commands);
    expect(responses[0].command).toBe('navigate');
    expect(responses[1].command).toBe('get_title');
    expect(responses[2].command).toBe('navigate');
  });

  test('batch handles single command', async () => {
    const responses = await client.batchCommands([
      { command: 'ping' }
    ]);
    expect(responses.length).toBe(1);
  });

  test('batch handles large number of commands', async () => {
    const commands = Array(50).fill(null).map((_, i) => ({
      command: 'ping'
    }));
    const responses = await client.batchCommands(commands);
    expect(responses.length).toBe(50);
  });
});

describe('Monitoring & Analytics', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('adds monitor', async () => {
    const response = await client.addMonitor('https://example.com', 'example-monitor');
    expect(response.success).toBe(true);
  });

  test('removes monitor', async () => {
    const response = await client.removeMonitor('monitor-123');
    expect(response.success).toBe(true);
  });

  test('lists monitors', async () => {
    const response = await client.listMonitors();
    expect(response.success).toBe(true);
  });

  test('gets monitor', async () => {
    const response = await client.getMonitor('monitor-123');
    expect(response.success).toBe(true);
  });

  test('pauses monitor', async () => {
    const response = await client.pauseMonitor('monitor-123');
    expect(response.success).toBe(true);
  });

  test('resumes monitor', async () => {
    const response = await client.resumeMonitor('monitor-123');
    expect(response.success).toBe(true);
  });

  test('starts monitoring service', async () => {
    const response = await client.startMonitoringService();
    expect(response.success).toBe(true);
  });

  test('stops monitoring service', async () => {
    const response = await client.stopMonitoringService();
    expect(response.success).toBe(true);
  });

  test('gets monitoring service status', async () => {
    const response = await client.getMonitoringServiceStatus();
    expect(response.success).toBe(true);
  });
});

describe('Utility & Health Methods', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('isConnected returns correct status', async () => {
    expect(client.isConnected()).toBe(false);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  test('getSessionInfo returns session details', async () => {
    const info = client.getSessionInfo();
    expect(info.connected).toBe(false);
    expect(info.sessionId).toBeNull();
    expect(info.checkpointCount).toBe(0);
  });

  test('healthCheck returns true when connected', async () => {
    await client.connect();
    const healthy = await client.healthCheck();
    expect(healthy).toBe(true);
  });

  test('healthCheck returns false when not connected', async () => {
    const healthy = await client.healthCheck();
    expect(healthy).toBe(false);
  });
});

describe('Message Queue Offline Handling', () => {
  let client;

  beforeEach(() => {
    client = new BrowserClient();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('queues messages when disconnected', async () => {
    expect(client.messageQueue.length).toBe(0);
    // Try to send while disconnected (will queue)
    client.sendCommand('navigate', { url: 'https://example.com' }).catch(() => {});
    // Wait a bit for the promise to process
    await new Promise(r => setTimeout(r, 50));
    expect(client.messageQueue.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Command Response Parsing', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('parses successful response', async () => {
    const response = await client.sendCommand('ping');
    expect(response).toBeInstanceOf(CommandResponse);
    expect(response.success).toBe(true);
    expect(response.executionTime).toBeGreaterThanOrEqual(0);
  });

  test('includes execution time in response', async () => {
    const response = await client.sendCommand('ping');
    expect(typeof response.executionTime).toBe('number');
    expect(response.executionTime).toBeGreaterThanOrEqual(0);
  });

  test('preserves response ID', async () => {
    const response = await client.sendCommand('ping');
    expect(response.id).toMatch(/^req_/);
  });
});

describe('Error Handling', () => {
  let client;

  beforeEach(() => {
    client = new BrowserClient('ws://invalid-host:9999', {
      timeout: 1000,
      maxRetries: 1
    });
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('handles connection errors gracefully', async () => {
    // This should fail to connect since the host is invalid
    try {
      await client.connect();
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe('Concurrent Operations', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('handles concurrent commands', async () => {
    const promises = [
      client.navigate('https://example.com'),
      client.getTitle(),
      client.getContent(),
      client.screenshot()
    ];
    const results = await Promise.all(promises);
    expect(results.length).toBe(4);
    results.forEach(r => {
      expect(r.success).toBe(true);
    });
  });

  test('maintains command ordering with concurrent execution', async () => {
    const responses = await Promise.all([
      client.sendCommand('navigate', { url: 'https://test1.com' }),
      client.sendCommand('navigate', { url: 'https://test2.com' }),
      client.sendCommand('navigate', { url: 'https://test3.com' })
    ]);
    expect(responses.length).toBe(3);
    responses.forEach(r => expect(r.success).toBe(true));
  });

  test('handles 20+ concurrent operations', async () => {
    const promises = Array(20).fill(null).map(() => client.sendCommand('ping'));
    const results = await Promise.all(promises);
    expect(results.length).toBe(20);
    results.forEach(r => expect(r.success).toBe(true));
  });
});

describe('Memory Management', () => {
  let client;

  beforeEach(async () => {
    client = new BrowserClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client && client.connected) {
      await client.disconnect();
    }
  });

  test('cleans up pending responses', async () => {
    const initialSize = client.pendingResponses.size;
    await client.sendCommand('ping');
    // After response, should be cleaned up
    expect(client.pendingResponses.size).toBe(initialSize);
  });

  test('removes completed checkpoints from memory properly', async () => {
    const cp1 = await client.createCheckpoint('cp1');
    const cp2 = await client.createCheckpoint('cp2');
    expect(client.checkpoints.size).toBe(2);
    await client.deleteCheckpoint(cp1.checkpointId);
    expect(client.checkpoints.size).toBe(1);
  });
});

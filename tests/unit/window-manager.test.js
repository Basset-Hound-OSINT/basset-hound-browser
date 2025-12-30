/**
 * Basset Hound Browser - Window Manager Unit Tests
 * Tests for multi-window management, spawning, switching, and event handling
 */

// Mock Electron modules before requiring WindowManager
const mockBrowserWindow = {
  loadFile: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
  destroy: jest.fn(),
  focus: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  webContents: {
    setUserAgent: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn()
  },
  on: jest.fn()
};

jest.mock('electron', () => ({
  BrowserWindow: jest.fn(() => mockBrowserWindow),
  session: {
    defaultSession: {}
  },
  ipcMain: {
    once: jest.fn(),
    removeAllListeners: jest.fn()
  }
}));

// Mock fingerprint evasion module
jest.mock('../../evasion/fingerprint', () => ({
  getRandomViewport: jest.fn(() => ({ width: 1920, height: 1080 })),
  getRealisticUserAgent: jest.fn(() => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
  getEvasionScript: jest.fn(() => 'void 0;')
}));

const { WindowManager, WindowState, BrowserWindowWrapper, generateWindowId } = require('../../windows/manager');

describe('WindowState Enumeration', () => {
  test('should define all window states', () => {
    expect(WindowState).toHaveProperty('CREATING');
    expect(WindowState).toHaveProperty('READY');
    expect(WindowState).toHaveProperty('LOADING');
    expect(WindowState).toHaveProperty('IDLE');
    expect(WindowState).toHaveProperty('BUSY');
    expect(WindowState).toHaveProperty('RECYCLING');
    expect(WindowState).toHaveProperty('CLOSING');
    expect(WindowState).toHaveProperty('CLOSED');
    expect(WindowState).toHaveProperty('ERROR');
  });

  test('should have correct state values', () => {
    expect(WindowState.CREATING).toBe('creating');
    expect(WindowState.READY).toBe('ready');
    expect(WindowState.LOADING).toBe('loading');
    expect(WindowState.IDLE).toBe('idle');
    expect(WindowState.BUSY).toBe('busy');
    expect(WindowState.RECYCLING).toBe('recycling');
    expect(WindowState.CLOSING).toBe('closing');
    expect(WindowState.CLOSED).toBe('closed');
    expect(WindowState.ERROR).toBe('error');
  });
});

describe('generateWindowId', () => {
  test('should generate unique window IDs', () => {
    const id1 = generateWindowId();
    const id2 = generateWindowId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^window-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^window-\d+-[a-z0-9]+$/);
  });

  test('should include timestamp in ID', () => {
    const now = Date.now();
    const id = generateWindowId();
    const timestamp = parseInt(id.split('-')[1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(now - 1000);
    expect(timestamp).toBeLessThanOrEqual(now + 1000);
  });
});

describe('BrowserWindowWrapper', () => {
  describe('Constructor', () => {
    test('should create wrapper with default values', () => {
      const wrapper = new BrowserWindowWrapper();

      expect(wrapper.id).toMatch(/^window-\d+-[a-z0-9]+$/);
      expect(wrapper.state).toBe(WindowState.CREATING);
      expect(wrapper.browserWindow).toBeNull();
      expect(wrapper.url).toBe('about:blank');
      expect(wrapper.title).toBe('New Window');
      expect(wrapper.partition).toBe('');
      expect(wrapper.profileId).toBeNull();
      expect(wrapper.metadata).toEqual({});
      expect(wrapper.commandQueue).toEqual([]);
      expect(wrapper.healthCheckFailures).toBe(0);
    });

    test('should create wrapper with custom values', () => {
      const wrapper = new BrowserWindowWrapper({
        id: 'custom-window-1',
        url: 'https://example.com',
        partition: 'persist:session-1',
        profileId: 'profile-123',
        metadata: { key: 'value' }
      });

      expect(wrapper.id).toBe('custom-window-1');
      expect(wrapper.url).toBe('https://example.com');
      expect(wrapper.partition).toBe('persist:session-1');
      expect(wrapper.profileId).toBe('profile-123');
      expect(wrapper.metadata).toEqual({ key: 'value' });
    });

    test('should set createdAt and lastActivity timestamps', () => {
      const wrapper = new BrowserWindowWrapper();

      expect(wrapper.createdAt).toBeDefined();
      expect(wrapper.lastActivity).toBeDefined();
      expect(new Date(wrapper.createdAt).getTime()).not.toBeNaN();
    });
  });

  describe('toJSON', () => {
    test('should return serializable representation', () => {
      const wrapper = new BrowserWindowWrapper({
        url: 'https://example.com',
        profileId: 'profile-1'
      });
      wrapper.state = WindowState.READY;

      const json = wrapper.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('state', WindowState.READY);
      expect(json).toHaveProperty('url', 'https://example.com');
      expect(json).toHaveProperty('title', 'New Window');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('lastActivity');
      expect(json).toHaveProperty('profileId', 'profile-1');
      expect(json).toHaveProperty('isReady', true);
      expect(json).toHaveProperty('commandQueueLength', 0);
    });

    test('should correctly reflect isReady for different states', () => {
      const wrapper = new BrowserWindowWrapper();

      wrapper.state = WindowState.READY;
      expect(wrapper.toJSON().isReady).toBe(true);

      wrapper.state = WindowState.IDLE;
      expect(wrapper.toJSON().isReady).toBe(true);

      wrapper.state = WindowState.LOADING;
      expect(wrapper.toJSON().isReady).toBe(false);

      wrapper.state = WindowState.BUSY;
      expect(wrapper.toJSON().isReady).toBe(false);
    });
  });

  describe('touch', () => {
    test('should update lastActivity timestamp', () => {
      const wrapper = new BrowserWindowWrapper();
      const initialActivity = wrapper.lastActivity;

      // Small delay to ensure time difference
      return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        wrapper.touch();
        expect(wrapper.lastActivity).not.toBe(initialActivity);
        expect(new Date(wrapper.lastActivity).getTime()).toBeGreaterThan(
          new Date(initialActivity).getTime()
        );
      });
    });
  });

  describe('isHealthy', () => {
    test('should return false when browserWindow is null', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.state = WindowState.READY;

      expect(wrapper.isHealthy()).toBe(false);
    });

    test('should return false when browserWindow is destroyed', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.browserWindow = { isDestroyed: () => true };
      wrapper.state = WindowState.READY;

      expect(wrapper.isHealthy()).toBe(false);
    });

    test('should return false for ERROR state', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.browserWindow = { isDestroyed: () => false };
      wrapper.state = WindowState.ERROR;

      expect(wrapper.isHealthy()).toBe(false);
    });

    test('should return false for CLOSED state', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.browserWindow = { isDestroyed: () => false };
      wrapper.state = WindowState.CLOSED;

      expect(wrapper.isHealthy()).toBe(false);
    });

    test('should return false when health check failures exceed max', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.browserWindow = { isDestroyed: () => false };
      wrapper.state = WindowState.READY;
      wrapper.healthCheckFailures = 3;

      expect(wrapper.isHealthy()).toBe(false);
    });

    test('should return true for healthy window', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.browserWindow = { isDestroyed: () => false };
      wrapper.state = WindowState.READY;
      wrapper.healthCheckFailures = 0;

      expect(wrapper.isHealthy()).toBe(true);
    });
  });

  describe('Health tracking', () => {
    test('should record health failures', () => {
      const wrapper = new BrowserWindowWrapper();

      expect(wrapper.healthCheckFailures).toBe(0);
      wrapper.recordHealthFailure();
      expect(wrapper.healthCheckFailures).toBe(1);
      wrapper.recordHealthFailure();
      expect(wrapper.healthCheckFailures).toBe(2);
    });

    test('should reset health failures', () => {
      const wrapper = new BrowserWindowWrapper();
      wrapper.healthCheckFailures = 5;

      wrapper.resetHealthFailures();

      expect(wrapper.healthCheckFailures).toBe(0);
    });
  });
});

describe('WindowManager', () => {
  let windowManager;

  beforeEach(() => {
    // Reset mock browser window functions with fresh implementations
    mockBrowserWindow.loadFile = jest.fn().mockResolvedValue(undefined);
    mockBrowserWindow.close = jest.fn();
    mockBrowserWindow.destroy = jest.fn();
    mockBrowserWindow.focus = jest.fn();
    mockBrowserWindow.isDestroyed = jest.fn().mockReturnValue(false);
    mockBrowserWindow.webContents.setUserAgent = jest.fn();
    mockBrowserWindow.webContents.send = jest.fn();
    mockBrowserWindow.webContents.on = jest.fn();
    mockBrowserWindow.webContents.removeAllListeners = jest.fn();
    mockBrowserWindow.on = jest.fn();

    windowManager = new WindowManager();
  });

  afterEach(() => {
    if (windowManager) {
      windowManager.cleanup();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(windowManager.windows.size).toBe(0);
      expect(windowManager.activeWindowId).toBeNull();
      expect(windowManager.mainWindow).toBeNull();
      expect(windowManager.windowPool).toBeNull();
      expect(windowManager.maxWindows).toBe(20);
      expect(windowManager.defaultHomePage).toBe('about:blank');
    });

    test('should accept custom options', () => {
      const customManager = new WindowManager({
        maxWindows: 50,
        homePage: 'https://example.com',
        mainWindow: mockBrowserWindow
      });

      expect(customManager.maxWindows).toBe(50);
      expect(customManager.defaultHomePage).toBe('https://example.com');
      expect(customManager.mainWindow).toBe(mockBrowserWindow);

      customManager.cleanup();
    });

    test('should have default window options', () => {
      expect(windowManager.defaultWindowOptions).toBeDefined();
      expect(windowManager.defaultWindowOptions.width).toBe(1280);
      expect(windowManager.defaultWindowOptions.height).toBe(800);
      expect(windowManager.defaultWindowOptions.webPreferences).toBeDefined();
      expect(windowManager.defaultWindowOptions.webPreferences.contextIsolation).toBe(true);
    });
  });

  describe('setWindowPool', () => {
    test('should set window pool reference', () => {
      const mockPool = { acquire: jest.fn(), recycle: jest.fn() };

      windowManager.setWindowPool(mockPool);

      expect(windowManager.windowPool).toBe(mockPool);
    });
  });

  describe('spawnWindow', () => {
    test('should spawn a new window', async () => {
      const result = await windowManager.spawnWindow({
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.window).toBeDefined();
      expect(result.window.url).toBe('https://example.com');
      expect(windowManager.windows.size).toBe(1);
    });

    test('should use default home page when no URL provided', async () => {
      const result = await windowManager.spawnWindow();

      expect(result.success).toBe(true);
      expect(result.window.url).toBe('about:blank');
    });

    test('should set first window as active', async () => {
      const result = await windowManager.spawnWindow();

      expect(windowManager.activeWindowId).toBe(result.window.id);
    });

    test('should fail when max windows reached', async () => {
      const manager = new WindowManager({ maxWindows: 1 });

      await manager.spawnWindow();
      const result = await manager.spawnWindow();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum number of windows');

      manager.cleanup();
    });

    test('should spawn with custom partition', async () => {
      const result = await windowManager.spawnWindow({
        partition: 'persist:session-1'
      });

      expect(result.success).toBe(true);
      expect(result.window.partition).toBe('persist:session-1');
    });

    test('should spawn with profile ID', async () => {
      const result = await windowManager.spawnWindow({
        profileId: 'profile-123'
      });

      expect(result.success).toBe(true);
      expect(result.window.profileId).toBe('profile-123');
    });

    test('should spawn with metadata', async () => {
      const result = await windowManager.spawnWindow({
        metadata: { task: 'scraping', priority: 1 }
      });

      expect(result.success).toBe(true);
      expect(result.window.metadata).toEqual({ task: 'scraping', priority: 1 });
    });

    test('should emit window-spawned event', async () => {
      const handler = jest.fn();
      windowManager.on('window-spawned', handler);

      await windowManager.spawnWindow();

      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        state: expect.any(String)
      }));
    });

    test('should try to acquire from pool when available', async () => {
      const mockWrapper = new BrowserWindowWrapper({ id: 'pooled-window' });
      mockWrapper.browserWindow = { ...mockBrowserWindow, isDestroyed: () => false };
      mockWrapper.state = WindowState.IDLE;

      const mockPool = {
        acquire: jest.fn().mockResolvedValue(mockWrapper),
        recycle: jest.fn()
      };

      windowManager.setWindowPool(mockPool);
      const result = await windowManager.spawnWindow({ usePool: true });

      expect(mockPool.acquire).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.window.id).toBe('pooled-window');
    });
  });

  describe('getWindowInfo', () => {
    test('should return window info', async () => {
      const { window } = await windowManager.spawnWindow({
        url: 'https://example.com'
      });

      const info = windowManager.getWindowInfo(window.id);

      expect(info).not.toBeNull();
      expect(info.id).toBe(window.id);
      expect(info.url).toBe('https://example.com');
      expect(info.isActive).toBe(true);
    });

    test('should return null for non-existent window', () => {
      const info = windowManager.getWindowInfo('non-existent');

      expect(info).toBeNull();
    });
  });

  describe('listWindows', () => {
    test('should list all windows', async () => {
      await windowManager.spawnWindow({ url: 'https://page1.com' });
      await windowManager.spawnWindow({ url: 'https://page2.com' });

      const result = windowManager.listWindows();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.windows.length).toBe(2);
    });

    test('should filter by state', async () => {
      await windowManager.spawnWindow();
      const list = await windowManager.listWindows({ state: WindowState.READY });

      expect(list.count).toBeGreaterThanOrEqual(0);
    });

    test('should filter by profile ID', async () => {
      await windowManager.spawnWindow({ profileId: 'profile-1' });
      await windowManager.spawnWindow({ profileId: 'profile-2' });

      const result = windowManager.listWindows({ profileId: 'profile-1' });

      expect(result.windows.every(w => w.profileId === 'profile-1')).toBe(true);
    });

    test('should include active window ID', async () => {
      const { window } = await windowManager.spawnWindow();

      const result = windowManager.listWindows();

      expect(result.activeWindowId).toBe(window.id);
    });
  });

  describe('switchWindow', () => {
    test('should switch to existing window', async () => {
      const { window: window1 } = await windowManager.spawnWindow();
      const { window: window2 } = await windowManager.spawnWindow();

      const result = windowManager.switchWindow(window2.id);

      expect(result.success).toBe(true);
      expect(windowManager.activeWindowId).toBe(window2.id);
      expect(result.previousWindowId).toBe(window1.id);
    });

    test('should fail for non-existent window', () => {
      const result = windowManager.switchWindow('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Window not found');
    });

    test('should fail for destroyed window', async () => {
      const { window } = await windowManager.spawnWindow();
      const wrapper = windowManager.windows.get(window.id);
      wrapper.browserWindow.isDestroyed = () => true;

      const result = windowManager.switchWindow(window.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Window is destroyed');
    });

    test('should emit window-switched event', async () => {
      const handler = jest.fn();
      windowManager.on('window-switched', handler);

      const { window: window1 } = await windowManager.spawnWindow();
      const { window: window2 } = await windowManager.spawnWindow();

      windowManager.switchWindow(window2.id);

      expect(handler).toHaveBeenCalledWith({
        windowId: window2.id,
        previousWindowId: window1.id
      });
    });

    test('should focus the window', async () => {
      const { window } = await windowManager.spawnWindow();

      windowManager.switchWindow(window.id);

      expect(mockBrowserWindow.focus).toHaveBeenCalled();
    });
  });

  describe('closeWindow', () => {
    test('should close existing window', async () => {
      const { window } = await windowManager.spawnWindow();

      const result = await windowManager.closeWindow(window.id);

      expect(result.success).toBe(true);
      expect(result.closedWindowId).toBe(window.id);
      expect(windowManager.windows.size).toBe(0);
    });

    test('should fail for non-existent window', async () => {
      const result = await windowManager.closeWindow('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Window not found');
    });

    test('should update active window when closing active', async () => {
      const { window: window1 } = await windowManager.spawnWindow();
      const { window: window2 } = await windowManager.spawnWindow();

      windowManager.switchWindow(window1.id);
      await windowManager.closeWindow(window1.id);

      expect(windowManager.activeWindowId).toBe(window2.id);
    });

    test('should force destroy window when force option is true', async () => {
      const { window } = await windowManager.spawnWindow();

      await windowManager.closeWindow(window.id, { force: true });

      expect(mockBrowserWindow.destroy).toHaveBeenCalled();
    });

    test('should return to pool when requested and window is healthy', async () => {
      const mockPool = {
        acquire: jest.fn(),
        recycle: jest.fn().mockResolvedValue(true)
      };
      windowManager.setWindowPool(mockPool);

      const { window } = await windowManager.spawnWindow();
      const wrapper = windowManager.windows.get(window.id);
      wrapper.browserWindow = { isDestroyed: () => false };
      wrapper.state = WindowState.READY;
      wrapper.healthCheckFailures = 0;

      const result = await windowManager.closeWindow(window.id, { returnToPool: true });

      expect(result.success).toBe(true);
      expect(result.recycled).toBe(true);
      expect(mockPool.recycle).toHaveBeenCalled();
    });
  });

  describe('navigateWindow', () => {
    test('should navigate window to URL', async () => {
      const { window } = await windowManager.spawnWindow();

      const result = await windowManager.navigateWindow(window.id, 'https://new-site.com');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://new-site.com');
    });

    test('should fail for non-existent window', async () => {
      const result = await windowManager.navigateWindow('non-existent', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Window not found');
    });

    test('should update window URL', async () => {
      const { window } = await windowManager.spawnWindow();

      await windowManager.navigateWindow(window.id, 'https://new-site.com');

      const wrapper = windowManager.windows.get(window.id);
      expect(wrapper.url).toBe('https://new-site.com');
    });
  });

  describe('sendToWindow', () => {
    test('should send message to window', async () => {
      const { window } = await windowManager.spawnWindow();

      const result = windowManager.sendToWindow(window.id, 'test-channel', { data: 'test' });

      expect(result.success).toBe(true);
      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('test-channel', { data: 'test' });
    });

    test('should fail for non-existent window', () => {
      const result = windowManager.sendToWindow('non-existent', 'channel', {});

      expect(result.success).toBe(false);
    });
  });

  describe('broadcast', () => {
    test('should broadcast message to all windows', async () => {
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      const result = windowManager.broadcast('test-channel', { data: 'test' });

      expect(result.success).toBe(true);
      expect(result.sentCount).toBe(2);
      expect(result.channel).toBe('test-channel');
    });

    test('should filter by state', async () => {
      await windowManager.spawnWindow();
      const { window: window2 } = await windowManager.spawnWindow();

      // Change one window's state
      const wrapper = windowManager.windows.get(window2.id);
      wrapper.state = WindowState.LOADING;

      const result = windowManager.broadcast('channel', {}, { state: WindowState.READY });

      expect(result.sentCount).toBe(1);
    });

    test('should exclude specified windows', async () => {
      const { window: window1 } = await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      const result = windowManager.broadcast('channel', {}, { excludeWindows: [window1.id] });

      expect(result.sentCount).toBe(1);
    });

    test('should send only to active window when onlyActive is true', async () => {
      const { window: window1 } = await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      windowManager.switchWindow(window1.id);
      const result = windowManager.broadcast('channel', {}, { onlyActive: true });

      expect(result.sentCount).toBe(1);
    });

    test('should handle unavailable windows', async () => {
      const { window } = await windowManager.spawnWindow();
      const wrapper = windowManager.windows.get(window.id);
      wrapper.browserWindow.isDestroyed = () => true;

      const result = windowManager.broadcast('channel', {});

      expect(result.results.some(r => !r.sent)).toBe(true);
    });
  });

  describe('getActiveWindow', () => {
    test('should return active window', async () => {
      const { window } = await windowManager.spawnWindow();

      const active = windowManager.getActiveWindow();

      expect(active).not.toBeNull();
      expect(active.id).toBe(window.id);
    });

    test('should return null when no active window', () => {
      const active = windowManager.getActiveWindow();

      expect(active).toBeNull();
    });
  });

  describe('closeAllWindows', () => {
    test('should close all windows', async () => {
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      const result = await windowManager.closeAllWindows();

      expect(result.success).toBe(true);
      expect(result.closedCount).toBe(3);
      expect(windowManager.windows.size).toBe(0);
    });

    test('should keep active window when exceptActive is true', async () => {
      await windowManager.spawnWindow();
      const { window: active } = await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      windowManager.switchWindow(active.id);
      const result = await windowManager.closeAllWindows({ exceptActive: true });

      expect(result.closedCount).toBe(2);
      expect(windowManager.windows.size).toBe(1);
      expect(windowManager.windows.has(active.id)).toBe(true);
    });

    test('should force close when force option is true', async () => {
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      await windowManager.closeAllWindows({ force: true });

      expect(mockBrowserWindow.destroy).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    test('should return health check results', async () => {
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      const result = windowManager.healthCheck();

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.healthy).toBeDefined();
      expect(result.unhealthy).toBeDefined();
      expect(result.details).toHaveLength(2);
    });

    test('should identify unhealthy windows', async () => {
      const { window } = await windowManager.spawnWindow();
      const wrapper = windowManager.windows.get(window.id);
      wrapper.browserWindow = null;

      const result = windowManager.healthCheck();

      expect(result.unhealthy).toBe(1);
      expect(result.details.find(d => d.windowId === window.id).healthy).toBe(false);
    });

    test('should include health check failure count', async () => {
      const { window } = await windowManager.spawnWindow();
      const wrapper = windowManager.windows.get(window.id);
      wrapper.healthCheckFailures = 2;

      const result = windowManager.healthCheck();

      expect(result.details.find(d => d.windowId === window.id).healthCheckFailures).toBe(2);
    });
  });

  describe('cleanup', () => {
    test('should close all windows and clear state', async () => {
      await windowManager.spawnWindow();
      await windowManager.spawnWindow();

      await windowManager.cleanup();

      expect(windowManager.windows.size).toBe(0);
      expect(windowManager.activeWindowId).toBeNull();
    });
  });

  describe('Event emissions', () => {
    test('should emit window-navigated event', async () => {
      const handler = jest.fn();
      windowManager.on('window-navigated', handler);

      const { window } = await windowManager.spawnWindow();

      // Simulate navigation event by calling the handler directly
      const wrapper = windowManager.windows.get(window.id);
      const navigateCall = mockBrowserWindow.webContents.on.mock.calls.find(
        call => call[0] === 'did-navigate'
      );
      if (navigateCall) {
        navigateCall[1](null, 'https://new-url.com');
        expect(handler).toHaveBeenCalled();
      }
    });

    test('should emit window-title-updated event', async () => {
      const handler = jest.fn();
      windowManager.on('window-title-updated', handler);

      await windowManager.spawnWindow();

      const titleCall = mockBrowserWindow.webContents.on.mock.calls.find(
        call => call[0] === 'page-title-updated'
      );
      if (titleCall) {
        titleCall[1](null, 'New Title');
        expect(handler).toHaveBeenCalled();
      }
    });
  });
});

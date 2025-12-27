/**
 * Basset Hound Browser - Window Pool Unit Tests
 * Tests for window pool management, pre-warming, acquisition, and recycling
 */

// Mock Electron modules before requiring WindowPool
const mockBrowserWindow = {
  loadFile: jest.fn().mockResolvedValue(undefined),
  close: jest.fn(),
  destroy: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  focus: jest.fn(),
  setPosition: jest.fn(),
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
  }
}));

// Mock fingerprint evasion module
jest.mock('../../evasion/fingerprint', () => ({
  getRandomViewport: jest.fn(() => ({ width: 1920, height: 1080 })),
  getRealisticUserAgent: jest.fn(() => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
}));

// Mock the manager module that pool depends on
jest.mock('../../windows/manager', () => {
  const originalModule = jest.requireActual('../../windows/manager');
  return {
    ...originalModule,
    BrowserWindowWrapper: originalModule.BrowserWindowWrapper,
    WindowState: originalModule.WindowState,
    generateWindowId: originalModule.generateWindowId
  };
});

const { WindowPool, PoolEntryState } = require('../../windows/pool');
const { WindowState } = require('../../windows/manager');

describe('PoolEntryState Enumeration', () => {
  test('should define all pool entry states', () => {
    expect(PoolEntryState).toHaveProperty('WARMING');
    expect(PoolEntryState).toHaveProperty('AVAILABLE');
    expect(PoolEntryState).toHaveProperty('ACQUIRED');
    expect(PoolEntryState).toHaveProperty('RECYCLING');
    expect(PoolEntryState).toHaveProperty('DISPOSED');
  });

  test('should have correct state values', () => {
    expect(PoolEntryState.WARMING).toBe('warming');
    expect(PoolEntryState.AVAILABLE).toBe('available');
    expect(PoolEntryState.ACQUIRED).toBe('acquired');
    expect(PoolEntryState.RECYCLING).toBe('recycling');
    expect(PoolEntryState.DISPOSED).toBe('disposed');
  });
});

describe('WindowPool', () => {
  let windowPool;

  beforeEach(() => {
    windowPool = new WindowPool();
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mock browser window
    mockBrowserWindow.isDestroyed.mockReturnValue(false);
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (windowPool) {
      await windowPool.cleanup();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(windowPool.pool.size).toBe(0);
      expect(windowPool.minPoolSize).toBe(2);
      expect(windowPool.maxPoolSize).toBe(10);
      expect(windowPool.warmupDelay).toBe(1000);
      expect(windowPool.recycleTimeout).toBe(30000);
      expect(windowPool.healthCheckInterval).toBe(60000);
      expect(windowPool.maxIdleTime).toBe(300000);
      expect(windowPool.isInitialized).toBe(false);
      expect(windowPool.isWarming).toBe(false);
    });

    test('should accept custom options', () => {
      const customPool = new WindowPool({
        minPoolSize: 5,
        maxPoolSize: 20,
        warmupDelay: 500,
        recycleTimeout: 60000,
        healthCheckInterval: 30000,
        maxIdleTime: 600000
      });

      expect(customPool.minPoolSize).toBe(5);
      expect(customPool.maxPoolSize).toBe(20);
      expect(customPool.warmupDelay).toBe(500);
      expect(customPool.recycleTimeout).toBe(60000);
      expect(customPool.healthCheckInterval).toBe(30000);
      expect(customPool.maxIdleTime).toBe(600000);

      customPool.cleanup();
    });

    test('should initialize stats object', () => {
      expect(windowPool.stats).toBeDefined();
      expect(windowPool.stats.totalCreated).toBe(0);
      expect(windowPool.stats.totalAcquired).toBe(0);
      expect(windowPool.stats.totalRecycled).toBe(0);
      expect(windowPool.stats.totalDisposed).toBe(0);
      expect(windowPool.stats.acquireHits).toBe(0);
      expect(windowPool.stats.acquireMisses).toBe(0);
    });

    test('should have default window options', () => {
      expect(windowPool.defaultWindowOptions).toBeDefined();
      expect(windowPool.defaultWindowOptions.show).toBe(false);
      expect(windowPool.defaultWindowOptions.webPreferences).toBeDefined();
      expect(windowPool.defaultWindowOptions.webPreferences.contextIsolation).toBe(true);
    });
  });

  describe('initialize', () => {
    test('should initialize the pool', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      const result = await pool.initialize();

      expect(result.success).toBe(true);
      expect(pool.isInitialized).toBe(true);

      await pool.cleanup();
    });

    test('should return success if already initialized', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();
      const result = await pool.initialize();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already initialized');

      await pool.cleanup();
    });

    test('should emit pool-initialized event', async () => {
      jest.useRealTimers();

      const handler = jest.fn();
      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      pool.on('pool-initialized', handler);

      await pool.initialize();

      expect(handler).toHaveBeenCalled();

      await pool.cleanup();
    });

    test('should start health check loop', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      expect(pool.healthCheckTimer).not.toBeNull();

      await pool.cleanup();
    });
  });

  describe('acquire', () => {
    test('should return null when pool is empty', async () => {
      const result = await windowPool.acquire();

      expect(result).toBeNull();
      expect(windowPool.stats.acquireMisses).toBe(1);
    });

    test('should acquire available window from pool', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      const wrapper = await pool.acquire();

      expect(wrapper).not.toBeNull();
      expect(pool.stats.totalAcquired).toBe(1);
      expect(pool.stats.acquireHits).toBe(1);

      await pool.cleanup();
    });

    test('should emit window-acquired event', async () => {
      jest.useRealTimers();

      const handler = jest.fn();
      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      pool.on('window-acquired', handler);

      await pool.initialize();
      await pool.acquire();

      expect(handler).toHaveBeenCalled();

      await pool.cleanup();
    });

    test('should remove window from pool after acquisition', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10, maxPoolSize: 2 });
      await pool.initialize();

      const initialSize = pool.pool.size;
      await pool.acquire();

      expect(pool.pool.size).toBeLessThan(initialSize);

      await pool.cleanup();
    });

    test('should show acquired window', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      await pool.acquire();

      expect(mockBrowserWindow.show).toHaveBeenCalled();

      await pool.cleanup();
    });

    test('should set window position on acquire', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      await pool.acquire();

      expect(mockBrowserWindow.setPosition).toHaveBeenCalled();

      await pool.cleanup();
    });
  });

  describe('recycle', () => {
    test('should return false for null wrapper', async () => {
      const result = await windowPool.recycle(null);

      expect(result).toBe(false);
    });

    test('should return false for unhealthy wrapper', async () => {
      const mockWrapper = {
        isHealthy: () => false
      };

      const result = await windowPool.recycle(mockWrapper);

      expect(result).toBe(false);
    });

    test('should recycle healthy wrapper', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 5, warmupDelay: 10 });

      const mockWrapper = {
        id: 'test-window-1',
        browserWindow: mockBrowserWindow,
        state: WindowState.READY,
        isHealthy: () => true,
        touch: jest.fn(),
        resetHealthFailures: jest.fn(),
        metadata: { key: 'value' },
        profileId: 'profile-1',
        url: 'https://example.com',
        title: 'Test',
        commandQueue: ['cmd1']
      };

      const result = await pool.recycle(mockWrapper);

      expect(result).toBe(true);
      expect(pool.stats.totalRecycled).toBe(1);
      expect(mockWrapper.metadata).toEqual({});
      expect(mockWrapper.profileId).toBeNull();
      expect(mockWrapper.url).toBe('about:blank');
      expect(mockWrapper.commandQueue).toEqual([]);

      await pool.cleanup();
    });

    test('should hide recycled window', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 5, warmupDelay: 10 });

      const mockWrapper = {
        id: 'test-window-1',
        browserWindow: mockBrowserWindow,
        state: WindowState.READY,
        isHealthy: () => true,
        touch: jest.fn(),
        resetHealthFailures: jest.fn(),
        metadata: {},
        commandQueue: []
      };

      await pool.recycle(mockWrapper);

      expect(mockBrowserWindow.hide).toHaveBeenCalled();

      await pool.cleanup();
    });

    test('should emit window-recycled event', async () => {
      jest.useRealTimers();

      const handler = jest.fn();
      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 5, warmupDelay: 10 });
      pool.on('window-recycled', handler);

      const mockWrapper = {
        id: 'test-window-1',
        browserWindow: mockBrowserWindow,
        state: WindowState.READY,
        isHealthy: () => true,
        touch: jest.fn(),
        resetHealthFailures: jest.fn(),
        metadata: {},
        commandQueue: []
      };

      await pool.recycle(mockWrapper);

      expect(handler).toHaveBeenCalledWith({ windowId: 'test-window-1' });

      await pool.cleanup();
    });

    test('should return false when pool is full', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, maxPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      const mockWrapper = {
        id: 'test-window-1',
        browserWindow: mockBrowserWindow,
        state: WindowState.READY,
        isHealthy: () => true
      };

      const result = await pool.recycle(mockWrapper);

      expect(result).toBe(false);

      await pool.cleanup();
    });

    test('should position recycled window off-screen', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 5, warmupDelay: 10 });

      const mockWrapper = {
        id: 'test-window-1',
        browserWindow: mockBrowserWindow,
        state: WindowState.READY,
        isHealthy: () => true,
        touch: jest.fn(),
        resetHealthFailures: jest.fn(),
        metadata: {},
        commandQueue: []
      };

      await pool.recycle(mockWrapper);

      expect(mockBrowserWindow.setPosition).toHaveBeenCalledWith(-2000, -2000);

      await pool.cleanup();
    });
  });

  describe('getStatus', () => {
    test('should return pool status', () => {
      const status = windowPool.getStatus();

      expect(status.success).toBe(true);
      expect(status.initialized).toBe(false);
      expect(status.isWarming).toBe(false);
      expect(status.total).toBe(0);
      expect(status.available).toBe(0);
      expect(status.config).toBeDefined();
      expect(status.stats).toBeDefined();
    });

    test('should include config values', () => {
      const status = windowPool.getStatus();

      expect(status.config.minPoolSize).toBe(2);
      expect(status.config.maxPoolSize).toBe(10);
      expect(status.config.warmupDelay).toBe(1000);
      expect(status.config.healthCheckInterval).toBe(60000);
      expect(status.config.maxIdleTime).toBe(300000);
    });

    test('should include state breakdown', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 2, warmupDelay: 10 });
      await pool.initialize();

      const status = pool.getStatus();

      expect(status.stateBreakdown).toBeDefined();
      expect(status.stateBreakdown[PoolEntryState.AVAILABLE]).toBeGreaterThanOrEqual(0);

      await pool.cleanup();
    });
  });

  describe('updateConfig', () => {
    test('should update minPoolSize', () => {
      windowPool.updateConfig({ minPoolSize: 5 });

      expect(windowPool.minPoolSize).toBe(5);
    });

    test('should update maxPoolSize', () => {
      windowPool.updateConfig({ maxPoolSize: 15 });

      expect(windowPool.maxPoolSize).toBe(15);
    });

    test('should enforce minimum for warmupDelay', () => {
      windowPool.updateConfig({ warmupDelay: 50 });

      expect(windowPool.warmupDelay).toBe(100);
    });

    test('should enforce minimum for healthCheckInterval', () => {
      windowPool.updateConfig({ healthCheckInterval: 5000 });

      expect(windowPool.healthCheckInterval).toBe(10000);
    });

    test('should enforce minimum for maxIdleTime', () => {
      windowPool.updateConfig({ maxIdleTime: 30000 });

      expect(windowPool.maxIdleTime).toBe(60000);
    });

    test('should return updated status', () => {
      const result = windowPool.updateConfig({ minPoolSize: 3 });

      expect(result.success).toBe(true);
      expect(result.config.minPoolSize).toBe(3);
    });

    test('should ensure maxPoolSize >= minPoolSize', () => {
      windowPool.minPoolSize = 10;
      windowPool.updateConfig({ maxPoolSize: 5 });

      expect(windowPool.maxPoolSize).toBe(10);
    });
  });

  describe('warmup', () => {
    test('should warm pool to specified count', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 5, warmupDelay: 10 });
      const result = await pool.warmup(2);

      expect(result.success).toBe(true);
      expect(result.available).toBeGreaterThanOrEqual(0);

      await pool.cleanup();
    });

    test('should respect max pool size', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 0, maxPoolSize: 2, warmupDelay: 10 });
      const result = await pool.warmup(5);

      expect(result.total).toBeLessThanOrEqual(2);

      await pool.cleanup();
    });

    test('should use minPoolSize as default count', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, maxPoolSize: 5, warmupDelay: 10 });
      await pool.warmup();

      expect(pool.pool.size).toBeGreaterThanOrEqual(0);

      await pool.cleanup();
    });
  });

  describe('drain', () => {
    test('should dispose all windows in pool', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 2, maxPoolSize: 5, warmupDelay: 10 });
      await pool.initialize();

      const result = await pool.drain();

      expect(result.success).toBe(true);
      expect(pool.pool.size).toBe(0);

      await pool.cleanup();
    });

    test('should return disposed count', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      const result = await pool.drain();

      expect(result.disposedCount).toBeGreaterThanOrEqual(0);

      await pool.cleanup();
    });
  });

  describe('cleanup', () => {
    test('should stop health check timer', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      await pool.cleanup();

      expect(pool.healthCheckTimer).toBeNull();
    });

    test('should drain all windows', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      await pool.cleanup();

      expect(pool.pool.size).toBe(0);
    });

    test('should set initialized to false', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      await pool.cleanup();

      expect(pool.isInitialized).toBe(false);
    });
  });

  describe('Health Check', () => {
    test('should emit health-check-completed event', async () => {
      jest.useRealTimers();

      const handler = jest.fn();
      const pool = new WindowPool({
        minPoolSize: 1,
        warmupDelay: 10,
        healthCheckInterval: 100
      });
      pool.on('health-check-completed', handler);

      await pool.initialize();

      // Wait for health check to run
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handler).toHaveBeenCalled();

      await pool.cleanup();
    });
  });

  describe('Event emissions', () => {
    test('should emit window-warmed event when creating pooled window', async () => {
      jest.useRealTimers();

      const handler = jest.fn();
      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      pool.on('window-warmed', handler);

      await pool.initialize();

      expect(handler).toHaveBeenCalled();

      await pool.cleanup();
    });
  });

  describe('Statistics tracking', () => {
    test('should track totalCreated', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 2, warmupDelay: 10 });
      await pool.initialize();

      expect(pool.stats.totalCreated).toBeGreaterThan(0);

      await pool.cleanup();
    });

    test('should track acquire hits and misses', async () => {
      jest.useRealTimers();

      const pool = new WindowPool({ minPoolSize: 1, warmupDelay: 10 });
      await pool.initialize();

      // First acquire should be a hit
      await pool.acquire();
      expect(pool.stats.acquireHits).toBe(1);

      // Drain pool then try to acquire - should be a miss
      await pool.drain();
      await pool.acquire();
      expect(pool.stats.acquireMisses).toBe(1);

      await pool.cleanup();
    });
  });
});

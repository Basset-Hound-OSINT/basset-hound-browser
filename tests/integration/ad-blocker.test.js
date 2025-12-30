/**
 * Basset Hound Browser - Ad Blocker Integration Tests
 * Tests for content blocking with complete Electron mock support
 */

// Mock fs module first
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('[]'),
  writeFileSync: jest.fn()
}));

// Create mock session with webRequest support
const createMockSession = () => {
  const listeners = {};
  return {
    webRequest: {
      onBeforeRequest: jest.fn((filter, listener) => {
        if (typeof filter === 'function') {
          listeners.onBeforeRequest = filter;
        } else if (listener) {
          listeners.onBeforeRequest = listener;
        }
      }),
      onBeforeSendHeaders: jest.fn((filter, listener) => {
        if (listener) listeners.onBeforeSendHeaders = listener;
      }),
      onHeadersReceived: jest.fn((filter, listener) => {
        if (listener) listeners.onHeadersReceived = listener;
      }),
      onCompleted: jest.fn((filter, listener) => {
        if (listener) listeners.onCompleted = listener;
      }),
      onErrorOccurred: jest.fn((filter, listener) => {
        if (listener) listeners.onErrorOccurred = listener;
      }),
      on: jest.fn((event, filter, listener) => {
        listeners[event] = typeof filter === 'function' ? filter : listener;
      })
    },
    cookies: {
      get: jest.fn().mockResolvedValue([]),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      flushStore: jest.fn().mockResolvedValue(undefined)
    },
    setProxy: jest.fn().mockResolvedValue(undefined),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    _listeners: listeners
  };
};

const mockSession = createMockSession();

jest.mock('electron', () => ({
  session: {
    defaultSession: mockSession,
    fromPartition: jest.fn(() => createMockSession())
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

const { BlockingManager } = require('../../blocking/manager');
const { session } = require('electron');
const fs = require('fs');

describe('BlockingManager Integration', () => {
  let blockingManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);

    // Reset the mock session's webRequest functions
    mockSession.webRequest.onBeforeRequest.mockClear();
    mockSession.webRequest.onBeforeSendHeaders.mockClear();

    // Create fresh instance
    blockingManager = new BlockingManager({
      dataPath: '/mock/blocking-data'
    });
  });

  afterEach(() => {
    if (blockingManager) {
      blockingManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      expect(blockingManager.isEnabled).toBe(false);
      expect(blockingManager.customRules).toEqual([]);
      expect(blockingManager.whitelistedDomains.size).toBe(0);
      expect(blockingManager.enabledCategories.has('ads')).toBe(true);
      expect(blockingManager.enabledCategories.has('trackers')).toBe(true);
    });

    test('should have default enabled categories', () => {
      expect(blockingManager.enabledCategories.has('ads')).toBe(true);
      expect(blockingManager.enabledCategories.has('trackers')).toBe(true);
      expect(blockingManager.enabledCategories.has('cryptominers')).toBe(true);
    });

    test('should have zero stats initially', () => {
      const stats = blockingManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.blockedRequests).toBe(0);
    });
  });

  describe('Enable/Disable Blocking', () => {
    test('should enable blocking', () => {
      const result = blockingManager.enableBlocking();

      expect(result.success).toBe(true);
      expect(blockingManager.isEnabled).toBe(true);
      expect(mockSession.webRequest.onBeforeRequest).toHaveBeenCalled();
    });

    test('should disable blocking', () => {
      blockingManager.enableBlocking();
      const result = blockingManager.disableBlocking();

      expect(result.success).toBe(true);
      expect(blockingManager.isEnabled).toBe(false);
    });

    test('should not enable twice', () => {
      blockingManager.enableBlocking();
      const result = blockingManager.enableBlocking();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already enabled');
    });

    test('should not disable when not enabled', () => {
      const result = blockingManager.disableBlocking();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already disabled');
    });
  });

  describe('Whitelist Management', () => {
    test('should whitelist a domain', () => {
      const result = blockingManager.whitelistDomain('example.com');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
      expect(blockingManager.whitelistedDomains.has('example.com')).toBe(true);
    });

    test('should remove www prefix from domain', () => {
      const result = blockingManager.whitelistDomain('www.example.com');

      expect(result.success).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    test('should remove domain from whitelist', () => {
      blockingManager.whitelistDomain('example.com');
      const result = blockingManager.removeWhitelist('example.com');

      expect(result.success).toBe(true);
      expect(blockingManager.whitelistedDomains.has('example.com')).toBe(false);
    });

    test('should return error when removing non-existent domain', () => {
      const result = blockingManager.removeWhitelist('nonexistent.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not in whitelist');
    });

    test('should get whitelist', () => {
      blockingManager.whitelistDomain('example.com');
      blockingManager.whitelistDomain('test.com');

      const result = blockingManager.getWhitelist();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.domains).toContain('example.com');
      expect(result.domains).toContain('test.com');
    });
  });

  describe('Custom Block Rules', () => {
    test('should add a block rule', () => {
      const result = blockingManager.addBlockRule('*tracking.js');

      expect(result.success).toBe(true);
      expect(result.rule.pattern).toBe('*tracking.js');
      expect(blockingManager.customRules).toHaveLength(1);
    });

    test('should remove a block rule', () => {
      blockingManager.addBlockRule('*tracking.js');
      const result = blockingManager.removeBlockRule('*tracking.js');

      expect(result.success).toBe(true);
      expect(blockingManager.customRules).toHaveLength(0);
    });

    test('should return error when removing non-existent rule', () => {
      const result = blockingManager.removeBlockRule('*nonexistent*');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rule not found');
    });

    test('should get block rules', () => {
      blockingManager.addBlockRule('*tracking.js');
      blockingManager.addBlockRule('*analytics*');

      const result = blockingManager.getBlockRules();

      expect(result.success).toBe(true);
      expect(result.customRules).toHaveLength(2);
    });
  });

  describe('Category Management', () => {
    test('should enable a category', () => {
      blockingManager.enabledCategories.delete('social');
      const result = blockingManager.setCategory('social', true);

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(blockingManager.enabledCategories.has('social')).toBe(true);
    });

    test('should disable a category', () => {
      const result = blockingManager.setCategory('ads', false);

      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(blockingManager.enabledCategories.has('ads')).toBe(false);
    });

    test('should return error for unknown category', () => {
      const result = blockingManager.setCategory('unknown', true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown category');
    });

    test('should get categories', () => {
      const result = blockingManager.getCategories();

      expect(result.success).toBe(true);
      expect(result.enabledCategories).toContain('ads');
    });
  });

  describe('Statistics', () => {
    test('should get stats', () => {
      const result = blockingManager.getStats();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('totalRequests');
      expect(result).toHaveProperty('blockedRequests');
      expect(result).toHaveProperty('blockedByCategory');
    });

    test('should clear stats', () => {
      blockingManager.stats.totalRequests = 100;
      blockingManager.stats.blockedRequests = 50;

      const result = blockingManager.clearStats();

      expect(result.success).toBe(true);
      expect(blockingManager.stats.totalRequests).toBe(0);
      expect(blockingManager.stats.blockedRequests).toBe(0);
    });
  });

  describe('Pattern Matching', () => {
    test('should match exact URL', () => {
      const result = blockingManager.matchesPattern(
        'https://ads.example.com/ad.js',
        'https://ads.example.com/ad.js'
      );

      expect(result).toBe(true);
    });

    test('should match wildcard pattern', () => {
      const result = blockingManager.matchesPattern(
        'https://ads.example.com/tracker.js',
        '*tracker*'
      );

      expect(result).toBe(true);
    });

    test('should not match different URL', () => {
      const result = blockingManager.matchesPattern(
        'https://example.com/page.html',
        '*ads*'
      );

      expect(result).toBe(false);
    });
  });

  describe('Export/Import Configuration', () => {
    test('should export configuration', () => {
      blockingManager.whitelistDomain('example.com');
      blockingManager.addBlockRule('*tracking*');

      const result = blockingManager.exportConfig();

      expect(result.success).toBe(true);
      expect(result.config.whitelistedDomains).toContain('example.com');
      expect(result.config.customRules).toHaveLength(1);
    });

    test('should import configuration', async () => {
      const config = {
        enabledCategories: ['ads', 'trackers'],
        customRules: [{ pattern: '*test*' }],
        whitelistedDomains: ['example.com']
      };

      const result = await blockingManager.importConfig(config);

      expect(result.success).toBe(true);
      expect(blockingManager.whitelistedDomains.has('example.com')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources', () => {
      blockingManager.enableBlocking();
      blockingManager.whitelistDomain('example.com');
      blockingManager.addBlockRule('*test*');

      blockingManager.cleanup();

      expect(blockingManager.isEnabled).toBe(false);
      expect(blockingManager.customRules).toHaveLength(0);
      expect(blockingManager.whitelistedDomains.size).toBe(0);
    });
  });
});
